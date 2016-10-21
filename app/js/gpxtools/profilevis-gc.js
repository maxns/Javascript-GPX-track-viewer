function ProfileVisualizer(jqelement) {
    this.jqelement = jqelement;
    this.options = {
        sampleSize: 5, // how many points to average for ele / dist measure
        splitSize: 1 // how many k's in a split
    }
}

ProfileVisualizer.prototype.drawGpx = function (gpxdata) {
    var series = [];
    var segmentCounter = 0;

    func.map(gpxdata.tracks, this, function (track) {

        func.map(track.segments, this, function (segment) {
            if (track.segments.length > 0 && track.segments[0].points.length > 0) {
                var starttime = track.segments[0].points[0].time;
                var endtime = track.segments[track.segments.length - 1].points[track.segments[track.segments.length - 1].points.length - 1].time;
            }

            var segmentdata = {
                yAxis: 1,
                name: 'segment EG ' + ++segmentCounter,
                data: {
                    time:["Time"],
                    ele:["Elevation"],
                    ascent:["Ascent"],
                    dst:["Distance"],
                    hr:["Heart Rate"]
                },


            };

            var sampleEle = 0;
            var sampleCount = 0;
            var eleGained = 0;
            var lastEle = -1;
            var totalDst = 0;
            var lastTotalDst = 0;
            var lastStartTime = -1;

            func.map(segment.points, this, function (point) {

                if (point.ele != undefined) {
                    sampleEle += point.ele;
                }
                if (point.dst != undefined) {
                    totalDst += point.dst;
                }

                if (point.ele != undefined && ++sampleCount == this.options.sampleSize) {
                    // var time = point.time;
                    var time = point.time - starttime;

                    var ele = Math.round(sampleEle / this.options.sampleSize);
                    if (lastEle == -1) lastEle = ele;
                    if (lastStartTime == -1) lastStartTime = time;

                    var eg = ele > lastEle ? ele - lastEle : 0;

                    eleGained += eg;

                    segmentdata.data.time.push(time);
                    segmentdata.data.ele.push(ele);
                    segmentdata.data.ascent.push(eleGained);
                    segmentdata.data.dst.push(totalDst);
                    segmentdata.data.hr.push(point.hr);

                    lastEle = ele;
                    sampleEle = 0;
                    sampleCount = 0;
                }

            });

            series.push(segmentdata);
        });
    });

    this._chartSeries(series);
}



ProfileVisualizer.prototype._chartSeries = function (seriesdata) {


    var data = new google.visualization.DataTable();
    var xVal = "time";
    var yVal = "ele";
    var y2Val = "ascent";

    data.addColumn('datetime', 'Time');
    data.addColumn('number', yVal);
    data.addColumn('number', y2Val);
    data.addColumn({type:'string', role:'annotation'});
    data.addColumn({type:'string', role:'annotationText'});
    data.addColumn('number', 'Distance');
    data.addColumn('number', 'HR');


    var lastTotalDst = 0;
    var lastAscent = 0;
    var lastTotalTime = 0;

    for(var i = 1; i< seriesdata[0].data[xVal].length; i++) {
        var annMarker = null, annText = null;
        var time = seriesdata[0].data['time'][i];
        var dst = seriesdata[0].data['dst'][i];
        var ascent = seriesdata[0].data.ascent[i];
        var hr = seriesdata[0].data.hr[i];

        switch(xVal) {
            case 'time':

                if (dst - lastTotalDst >= this.options.splitSize) {
                    annMarker = Math.floor(dst) + "k";
                    annText = annMarker + ":"
                        + "\nEG:" + (ascent - lastAscent) + " m"
                        + "\nTime:" + Math.floor((time - lastTotalTime)/1000/60) + " min"
                    + ""
                    ;
                    lastAscent = ascent;
                    lastTotalTime = time;
                    lastTotalDst = dst;
                }
                break;
            case 'dst':
                break;
        }

        data.addRow([
            new Date(seriesdata[0].data[xVal][i]),
            seriesdata[0].data[yVal][i],
            seriesdata[0].data[y2Val][i],
            annMarker,
            annText,
            dst,
            hr
        ]);
    }


    var chartOptions = {
        'title': 'Time vs Ele/Gained',
        'width': '100%',
        'height': '100%',
        vAxis: { title: yVal},
        xAxis: { title: xVal},
        seriesType: 'area',
        series: {

            2: {
                targetAxisIndex: 1,
                type:'line'
            }
        },
        vAxes: {
            0: {
                title: 'Ele'
            },
            1: {
                title: 'HR'
            }
        }

    };

    // Instantiate and draw our chart, passing in some options.
    var chartData = new google.visualization.DataView(data);
    chartData.setColumns([0,1,2,3,4,6]);

    var chart = new google.visualization.ComboChart(document.getElementById(this.jqelement.attr('id')+"-chart"));
    chart.draw(chartData, chartOptions);

    var tableData = new google.visualization.DataView(data);
    tableData.setColumns([0,1,2,5,6]);

    var table = new google.visualization.Table(document.getElementById(this.jqelement.attr('id')+"-table"));
    table.draw(tableData, null);

    function selectHandler(e) {
        var selection = chart.getSelection();

        console.log(selection);
    }
    google.visualization.events.addListener(chart, 'select', selectHandler);


}


