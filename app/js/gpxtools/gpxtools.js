/*global DOMParser, ActiveXObject */
/*global func */
/*global console, window */
/*global google.maps.LatLng, google.maps.LatLngBounds, google.maps.Polyline, google.maps.Event, google.maps.Marker */
// process extensions
var GPX_extensions = [
	{name:'hr',tag:'hr'},
	{name:'cadence',tag:'cadence'},
	{name:'temp',tag:'temp'},
	{name:'distance',tag:'distance'},
	{name:'altitude',tag:'altitude'},
	{name:'seaLevelPressure',tag:'seaLevelPressure'},
	{name:'speed',tag:'speed'},
	{name:'verticalSpeed',tag:'verticalSpeed'},
];

function GPXParser(map)
{
	this.xmlDoc = null;
	this.map = map;
	this.trackcolor = "#ff00ff"; // red
	this.segmentcolorprovider = function (pnt1, pnt2) {
		return this.trackcolor;
	};
	this.trackwidth = 5;
	this.routecolor = '#ff00ff';
	this.routewidth = 3;
	this.mintrackpointdelta = 0.0; // in km
	this.maxtrackpointdelta = 30.0; // in km
	this.markers = [];

	/*
	// augment the v3 api: http://stackoverflow.com/questions/1544739/google-maps-api-v3-how-to-remove-all-markers/1903905#1903905
	if (google.maps.Map.prototype.clearMarkers == undefined) {
		google.maps.Map.prototype.clearMarkers = function () {
			for(var i=0; i < google.maps.Map.prototype.markers.length; i++){
				google.maps.Map.prototype.markers[i].setMap(null);
				delete google.maps.Map.prototype.markers[i];
			}
			google.maps.Map.prototype.markers = [];
		};
	}
	*/
}

// Set the color of the track line segements.
GPXParser.prototype.SetTrackcolor = function (color)
{
	this.trackcolor = color;
};

// Set the color of the track line segements.
GPXParser.prototype.SetSegmentColorProvider = function (colorProvider)
{
	this.segmentcolorprovider = colorProvider;
};

// Set the width of the track line segements
GPXParser.prototype.SetTrackWidth = function (width)
{
	this.trackwidth = width;
};

// Set the minimum distance between trackpoints.
// Used to cull unneeded trackpoints from map.
GPXParser.prototype.SetMinTrackPointDelta = function (delta)
{
	this.mintrackpointdelta = delta;
};

// Set the maximum distance between trackpoints.
// Used to cull gps bugs.
GPXParser.prototype.SetMaxTrackPointDelta = function (delta)
{
	this.maxtrackpointdelta = delta;
};

GPXParser.prototype.TranslateName = function (name)
{
	if (name === "wpt")
	{
		return "Waypoint";
	}
	else if (name === "trkpt")
	{
		return "Track Point";
	}
	return name;
};

GPXParser.prototype.textToXml = function (text) {
	var xmlDoc, parser;
	
	if (window.DOMParser) {
		parser = new DOMParser();
		xmlDoc = parser.parseFromString(text, "text/xml");
	}
	else // Internet Explorer
	{
		xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
		xmlDoc.async = "false";
		xmlDoc.loadXML(text);
	}
	return xmlDoc;
};

// ---------------------- PARSING ----------------------------------

// parses gpx to internal structure
GPXParser.prototype.ParseGpx = function (xmlstring)
{
	var xmlDoc, data, tracks, waypoints, routes, gpxParser;
	
	gpxParser = this;
	
	xmlDoc = this.textToXml(xmlstring);

	data = {
		tracks: Functional.reduce(
			function (list, track) {
				list.push(gpxParser.parseTrack(track));
				return list;
			},
			[],
			xmlDoc.documentElement.getElementsByTagName("trk")),
		waypoints: [],
		routes: []
		};
	
	/*
	tracks = xmlDoc.documentElement.getElementsByTagName("trk");
	for (var i = 0; i < tracks.length; i++)
	{
		data.tracks.push(this.parseTrack(tracks[i]));
	}
	*/
	
	waypoints = xmlDoc.documentElement.getElementsByTagName("wpt");
	for (var i = 0; i < waypoints.length; i++)
	{
		data.waypoints.push(this.parseWaypoint(waypoints[i]));
	}

	routes = xmlDoc.documentElement.getElementsByTagName("rte");
	for (var i = 0; i < routes.length; i++)
	{
		data.routes.push(this.parseRoute(routes[i]));
	}

	return data;
};

GPXParser.prototype.parseTrack = function (trackxml) {
	var track = {
		segments: [],
		length: 0
	};

	var segments = trackxml.getElementsByTagName("trkseg");
	for (var i = 0; i < segments.length; i++)
	{
		var segment = this.parseSegment(segments[i]);
		track.segments.push(segment);
		track.length += segment.length;
	}

	return track;
};

GPXParser.prototype.parseSegment = function (segmentxml) {
	var segment = { 
		points: [],
		length: 0
	};

	var trackpoints = segmentxml.getElementsByTagName("trkpt");
	if (trackpoints.length == 0)
	{
		return segment;
	}

	// process first point
	var lastpnt = this.parseTrackPoint(trackpoints[0]);
	segment.points.push(lastpnt);

	for (var i=1; i < trackpoints.length; i++)
	{
		var pnt = this.parseTrackPoint(trackpoints[i], lastpnt);


		var dist = this._pntDistance(lastpnt, pnt);
		if (this.maxtrackpointdelta > 0 &&
			dist > this.maxtrackpointdelta) {
			// alert(dist);
			console.debug('buggy point: lat=' + pnt.lan + ', lon=' + pnt.lon + ' (dist = ' + dist + ' km)');
			continue;
		}
		segment.points.push(pnt);
		segment.length += dist;
		lastpnt = pnt;
	}

	return segment;
};

GPXParser.prototype.parseRoute = function (routexml) {
	var route = {
		points: []
	};

	var routepoints = routexml.getElementsByTagName("rtept");

	for (var i=0; i < routepoints.length; i++)
	{
		route.points.push(this.parseRoutePoint(routepoints[i]));
	}

	return route;
};


GPXParser.prototype.parseRoutePoint = function (routepoint) {
	var pnt = {
		lat: 0,
		lon: 0,
		latLng: null,
		name: '',
		comment: '',
		html: ''
	};

	pnt.lat = parseFloat(routepoint.getAttribute('lat'));
	pnt.lon = parseFloat(routepoint.getAttribute('lon'));
	pnt.latlng = new google.maps.LatLng(pnt.lat,pnt.lon);
		
	var names = routepoint.getElementsByTagName("name");
	if (names[0] !== undefined) {
		pnt.name = names[0].textContent;
		pnt.html = '<b>' + pnt.name + '</b>';
	}
	
	var cmts = routepoint.getElementsByTagName("cmt");
	if (cmts[0] !== undefined) {
		pnt.comment = cmts[0].textContent; 
		pnt.html += '<br />' + pnt.comment;
	}

	return pnt;
};

GPXParser.prototype.parseWaypoint = function (xmlwaypoint) {
	var waypoint = {
		lon: parseFloat(xmlwaypoint.getAttribute("lon")),
		lat: parseFloat(xmlwaypoint.getAttribute("lat")),
		html: ''
	};

	if (xmlwaypoint.getElementsByTagName("html").length > 0)
	{
		for (var i = 0; i<xmlwaypoint.getElementsByTagName("html").item(0).childNodes.length; i++)
		{
			waypoint.html += xmlwaypoint.getElementsByTagName("html").item(0).childNodes[i].nodeValue;
		}
	}
	else
	{
		// Create the html if it does not exist in the point.
		waypoint.html = "<b>" + this.TranslateName(xmlwaypoint.nodeName) + "</b><br>";
		var attributes = xmlwaypoint.attributes;
		var attrlen = attributes.length;
		for (var i = 0; i < attrlen; i++)
		{
			waypoint.html += attributes.item(i).name + " = " + attributes.item(i).nodeValue + "<br>";
		}

		if (xmlwaypoint.hasChildNodes)
		{
			var children = xmlwaypoint.childNodes;
			var childrenlen = children.length;
			for (i=0; i<childrenlen; i++)
			{
				// Ignore empty nodes
				if (children[i].nodeType != 1) { continue; }
				if (children[i].firstChild == null) { continue; }
				waypoint.html += children[i].nodeName + " = " + children[i].firstChild.nodeValue + "<br>";
			}
		}
	}

	return waypoint;
};


// ---------------------- DRAWING ----------------------------------

GPXParser.prototype.DrawGpx = function (gpxdata, maptype, drawTracks, drawWaypoints, drawRoutes) {
	if (maptype == null) {
		maptype = this.map.getMapTypeId();
	}

	if (drawTracks == null) {
		drawTracks = true;
	}

	if (drawWaypoints == null) {
		drawWaypoints = true;
	}

	if (drawRoutes == null) {
		drawRoutes = true;
	}

	this._clearMarkers();

	this._centerAndZoom(gpxdata, maptype);

	if (drawTracks)
		func.map(gpxdata.tracks, this, this._drawTrack, this.segmentcolorprovider, this.trackwidth);

	if (drawWaypoints)
		func.map(gpxdata.waypoints, this, this._drawWaypoint);

	if (drawRoutes)
		func.map(gpxdata.routes, this, this._drawRoute, this.routecolor, this.routewidth);
};

GPXParser.prototype._drawTrack = function (track, segmentcolorprovider, trackwidth) {
	func.map(track.segments, this, this._drawSegment, segmentcolorprovider, trackwidth);
};

GPXParser.prototype._drawSegment = function (segment, segmentcolorprovider, trackwidth) {
	if (segment.points.length == 0)
		return;

	var lastpnt = segment.points[0];

	for (var i=1; i < segment.points.length; i++)
	{
		var pnt = segment.points[i];
		var linesegment = [lastpnt.latlng, pnt.latlng];

		// Verify that this is far enough away from the last point to be used, and draw the segment
		if (this._pntDistance(lastpnt, pnt) > this.mintrackpointdelta)
		{
			var color = segmentcolorprovider(lastpnt, pnt);
			var polyline = new google.maps.Polyline({
				path: linesegment,
				strokeColor: color,
				strokeWeight: trackwidth
			}

			);
			polyline.setMap(this.map);
		}

		lastpnt = pnt;
	}
};

GPXParser.prototype._drawRoute = function (route, color, trackwidth) {
	if (route.points.length == 0)
		return;

	var lastpnt = route.points[0];
	this._drawWaypoint(lastpnt);

	for (var i=1; i < route.points.length; i++)
	{
		var pnt = route.points[i];
		var linesegment = [lastpnt.latlng, pnt.latlng];

		var polyline = new google.maps.Polyline(linesegment, color, trackwidth);
		this._addOverlay(polyline);
		
		this._drawWaypoint(pnt);

		lastpnt = pnt;
	}
};

GPXParser.prototype._drawWaypoint = function (waypoint) {
	var marker = new google.maps.Marker(new google.maps.LatLng(waypoint.lat,waypoint.lon));
	google.maps.Event.addListener(marker, "click", function () {
		marker.openInfoWindowHtml(waypoint.html);
	});

	this._addOverlay(marker);
};

// ---------------------- UTILITIES ----------------------------------


GPXParser.prototype._degToRad = function (deg) {
	return deg * Math.PI / 180;
};

// thanks: http://www.movable-type.co.uk/scripts/latlong.html
// returns distance between two points, in km
GPXParser.prototype._pntDistance = function (pnt1, pnt2) {

	var lat1 = pnt1.lat;
	var lon1 = pnt1.lon;
	var lat2 = pnt2.lat;
	var lon2 = pnt2.lon;

	var R = 6371; // km
	var dLat = this._degToRad(lat2-lat1);
	var dLon = this._degToRad(lon2-lon1);
	var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
			Math.cos(this._degToRad(lat1)) * Math.cos(this._degToRad(lat2)) *
			Math.sin(dLon/2) * Math.sin(dLon/2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	var d = R * c;

	return d; // km
};

GPXParser.prototype.parseTrackPoint = function (trackpoint, lastpnt) {
	var pnt = {};

	pnt.lat = parseFloat(trackpoint.getAttribute('lat'));
	pnt.lon = parseFloat(trackpoint.getAttribute('lon'));
	pnt.latlng = new google.maps.LatLng(pnt.lat,pnt.lon);

	var elmsElevation = trackpoint.getElementsByTagName('ele');
	if (elmsElevation.length > 0) {
		pnt.ele = parseFloat(elmsElevation[0].textContent);
	}

	var elmsTime = trackpoint.getElementsByTagName('time');
	if (elmsTime.length > 0) {
		pnt.time = Date.parse(elmsTime[0].textContent);
	}

	if (lastpnt != null) {
		pnt.timediff = pnt.time - lastpnt.time;
		pnt.dst = this._pntDistance(lastpnt, pnt);
		pnt.spd = pnt.dst / pnt.timediff * 1000 * 60 * 60;
		if (pnt.ele != undefined && lastpnt.ele != undefined)
			pnt.elediff = pnt.ele - lastpnt.ele;
	}

	this.processExtensions(pnt, trackpoint);

	return pnt;
};

GPXParser.prototype.processExtensions = function(target, element) {
	for(var i in GPX_extensions) {

		var extEl = element.getElementsByTagName(GPX_extensions[i].tag);

		if(extEl.length > 0) {
			target[GPX_extensions[i].name] = parseFloat(extEl[0].textContent);
		}
	}

};

GPXParser.prototype._centerAndZoom = function (gpxdata, maptype)
{
	var minlat = 0;
	var maxlat = 0;
	var minlon = 0;
	var maxlon = 0;

	var updateBounds = function (pnt) {
		// If the min and max are uninitialized then initialize them.
		if ((minlat == maxlat) && (minlat == 0))
		{
			minlat = pnt.lat;
			maxlat = pnt.lat;
			minlon = pnt.lon;
			maxlon = pnt.lon;
		}
		if (pnt.lon < minlon) minlon = pnt.lon;
		if (pnt.lon > maxlon) maxlon = pnt.lon;
		if (pnt.lat < minlat) minlat = pnt.lat;
		if (pnt.lat > maxlat) maxlat = pnt.lat;
	}

	func.map(gpxdata.waypoints, this, updateBounds);

	func.map(gpxdata.tracks, this, function (track) {
		func.map(track.segments, this, function (segment) {
			func.map(segment.points, this, updateBounds);
		});
	});

	func.map(gpxdata.routes, this, function (route) {
		func.map(route.points, this, updateBounds);
	});


	if ((minlat == maxlat) && (minlat == 0))
	{
		this.map.setCenter(new google.maps.LatLng(49.327667, -122.942333), 14);
		return;
	}

	// Center around the middle of the points
	var centerlon = (maxlon + minlon) / 2;
	var centerlat = (maxlat + minlat) / 2;

	var bounds = new google.maps.LatLngBounds(new google.maps.LatLng(minlat, minlon), new google.maps.LatLng(maxlat, maxlon));

	//this.map.setCenter(new google.maps.LatLng(centerlat, centerlon), getZoomByBounds(this.map,bounds));
	this.map.fitBounds( bounds );
}
;
/**
 * Returns the zoom level at which the given rectangular region fits in the map view.
 * The zoom level is computed for the currently selected map type.
 * @param {google.maps.Map} map
 * @param {google.maps.LatLngBounds} bounds
 * @return {Number} zoom level
 **/
function getZoomByBounds( map, bounds ){
	var MAX_ZOOM = map.mapTypes.get( map.getMapTypeId() ).maxZoom || 21 ;
	var MIN_ZOOM = map.mapTypes.get( map.getMapTypeId() ).minZoom || 0 ;

	var ne= map.getProjection().fromLatLngToPoint( bounds.getNorthEast() );
	var sw= map.getProjection().fromLatLngToPoint( bounds.getSouthWest() );

	var worldCoordWidth = Math.abs(ne.x-sw.x);
	var worldCoordHeight = Math.abs(ne.y-sw.y);

	//Fit padding in pixels
	var FIT_PAD = 40;

	for( var zoom = MAX_ZOOM; zoom >= MIN_ZOOM; --zoom ){
		if( worldCoordWidth*(1<<zoom)+2*FIT_PAD < $(map.getDiv()).width() &&
			worldCoordHeight*(1<<zoom)+2*FIT_PAD < $(map.getDiv()).height() )
			return zoom;
	}
	return 0;
}

GPXParser.prototype._addOverlay = function (marker)
{
	this.markers.push(marker);
	marker.setMap(this.map);
}

GPXParser.prototype._clearMarkers = function ()
{
	for(var i=0; i < this.markers.length; i++){
		if (this.markers[i].setMap != undefined)
			this.markers[i].setMap(null);

		if (this.markers[i].remove != undefined)
			this.markers[i].remove();
	}
	this.markers.length = 0;
}

