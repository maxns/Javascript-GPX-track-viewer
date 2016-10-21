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
                yAxis: 0,
                name: 'segment ' + ++segmentCounter,
                data: []
            };

            var bufferSum = 0;
            var bufferCnt = 0;

            func.map(segment.points, this, function (point) {

                if (point.ele != undefined) {
                    bufferSum += point.ele;

                    if (++bufferCnt == this.options.sampleSize) {
                        var ele = Math.round(bufferSum / this.options.sampleSize);
                        // var time = point.time;
                        var time = point.time - starttime;

                        segmentdata.data.push([time, ele]);

                        bufferCnt = 0;
                        bufferSum = 0;
                    }

                    // segmentdata.data.push([point.time, point.ele]);
                }
            });

            series.push(segmentdata);
        });

        // now let's add elevation gain

        func.map(track.segments, this, function (segment) {
            if (track.segments.length > 0 && track.segments[0].points.length > 0) {
                var starttime = track.segments[0].points[0].time;
                var endtime = track.segments[track.segments.length - 1].points[track.segments[track.segments.length - 1].points.length - 1].time;
            }

            var segmentdata = {
                yAxis: 1,
                name: 'segment EG ' + ++segmentCounter,
                data: []
            };

            var sampleEle = 0;
            var sampleCount = 0;
            var eleGained = 0;
            var lastEle = -1;
            var totalDst = 0;
            var lastTotalDst = 0;


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
                    var eg = ele > lastEle ? ele - lastEle : 0;

                    eleGained += eg;

                    if (totalDst - lastTotalDst >= this.options.splitSize) {
                        lastTotalDst = totalDst;
                        //console.log("at total dist:" + totalDst);

                        segmentdata.data.push([time, {
                            y: eleGained,
                            color: '#ff0000',
                            name: "at " + totalDst
                            /*marker: {
                                fillColor: '#ff0000',
                                radius: 10,
                                //name: Math.floor(totalDst) + "k"
                            }*/
                        }
                        ]);

                    } else {
                        segmentdata.data.push([time, eleGained]);

                    }


                    lastEle = ele;
                    sampleEle = 0;
                    sampleCount = 0;


                    // segmentdata.data.push([point.time, point.ele]);
                }

            });

            series.push(segmentdata);
        });
    });

    this._chartSeries(series);
}

ProfileVisualizer.prototype._chartSeries = function (seriesdata) {

    var chart = new Highcharts.Chart({
        chart: {
            renderTo: this.jqelement.attr('id'),
            type: 'area'
        },
        title: {
            text: ''
        },
        subtitle: {
            text: ''
        },
        legend: {
            enabled: false
        },
        xAxis: {
            type: 'datetime',
            dateTimeLabelFormats: { // don't display the dummy year
                month: '%e. %b',
                year: '%b'
            }
        },
        yAxis: [{
            title: {
                text: 'Elevation (m)'
            }
            //,min: 0
        },
            {
                title: {
                    text: 'Elev Gain (m)'
                },
                opposite: true
                //,min: 0
            }],
        tooltip: {
            formatter: function () {
                return Highcharts.dateFormat('%H:%M:%S', this.x) + ': ' + this.y + ' m ' + (this.name!=undefined?"this.name":"");
            },
            crosshairs: [true, true]
        },
        plotOptions: {
            area: {
                fillColor: {
                    linearGradient: [0, 0, 0, 200],
                    stops: [
                        [0, 'rgba(192,192,192,0.5)'],
                        [1, 'rgba(64,64,64,0.5)']
                    ]
                },
                lineWidth: 1,
                lineColor: '#4040ff',
                /*
                 lineColor: {
                 linearGradient: [0, 0, 0, 200],
                 stops: [
                 [0, 'rgba(255,0,0,1)'],
                 [1, 'rgba(0,0,255,1)']
                 ]
                 },
                 */
                marker: {
                    enabled: false,
                    states: {
                        hover: {
                            enabled: true,
                            radius: 5
                        }
                    }
                },
                shadow: false,
                states: {
                    hover: {
                        lineWidth: 1
                    }
                }
            }
        },

        series: seriesdata
    });
}
