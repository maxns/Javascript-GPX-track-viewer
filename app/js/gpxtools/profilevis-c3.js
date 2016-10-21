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
                    time:["time"],
                    ele:["ele"],
                    ascent:["eleGained"],
                    dst:["dst"]
                },
                regions: {
                    dst:[],
                    time:[]
                }

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


                    if (totalDst - lastTotalDst >= this.options.splitSize) {
                        lastTotalDst = totalDst;
                        segmentdata.regions.dst.push({
                            start: lastStartTime,
                            end: time
                        });
                        lastStartTime = time;

                    }
                    segmentdata.data.time.push(time);
                    segmentdata.data.ele.push(ele);
                    segmentdata.data.ascent.push(eleGained);
                    segmentdata.data.dst.push(totalDst);

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
    this.jqelement.html('');

    var xaxisConfigs = {
        time: {
            name:"time",
            config: {
                type: 'timeseries',
                tick: {
                    format: '%H:%M',
                    rotate: -90,
                    culling: {
                        max: 100
                    }
                }
            }
        },
        dst: {
            name: "dst",
            config: {
                type: 'indexed',
                tick: {
                    format: function(x) { return Math.round(x*100)/100; },
                    rotate: -90,
                    culling: {
                        max: 20
                    }
                }
            }
        }
    };
    var xConfig = xaxisConfigs.dst;

    var chart = c3.generate({
        bindto: '#'+this.jqelement.attr('id'),
        data: {
            x: xConfig.name,
            columns: [
                seriesdata[0].data[xConfig.name],
                seriesdata[0].data.ele,
                seriesdata[0].data.ascent,
            ],
            axes: {
                ele: 'y',
                ascent: 'y2'
            }

        },
        axis: {
            y2: {
                show:true
            },
            x: xConfig.config
        }
    });

}
