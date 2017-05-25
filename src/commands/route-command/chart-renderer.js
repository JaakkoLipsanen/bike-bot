const ChartjsNode = require('chartjs-node');

// TODO: are this ok for all values?
const getStepSizeFrom = (distance) => {
	if(distance < 140) return 5;
	if(distance < 300) return 10;
	if(distance < 1000) return 25;

	return 50;
};

// TODO: this might not be 100% accurate. I should only render as many points as is
const getHorizontalLabelsFrom = (route) => {
	const labels = [];

	const routeDistanceInKm = route.distance / 1000;
	const count = route.elevationData.length;

	for(let i = 0; i <= count; i++) {
		labels.push(Math.round(routeDistanceInKm * (i / count)));
	}

	return labels;
};

const createChartOpts = (route) => {
	const labels = getHorizontalLabelsFrom(route); // x axis labels
	const data = route.elevationData.map(p => ({ x: p.distance, y: p.elevation }) ); // y-axis

	const routeLengthInKm = Math.round(route.distance / 1000); // in km
	const stepSize = getStepSizeFrom(routeLengthInKm);

	return {
		type: "line",
		data: {
			labels: labels,
			datasets: [{
				data: data,
				tension: 0.5, pointRadius: 0, fill: true,
				backgroundColor: "rgba(64, 64, 64, 0.75)",
			}]
		},
		options: {
			legend: { display: false },
			layout: { padding: 16 },
			scales: {
				/* this first xAxes value is required for some reason.
				   without it, the data isn't shown on the chart */
				xAxes: [{ position: "top", ticks: { callback() { } } }, {
					type: "linear", position: "bottom",
					scaleLabel: { display: true, labelString: "kilometers" },
					ticks: {
						min: 0, max: routeLengthInKm,
						stepSize: stepSize
					},
				}],
				yAxes: [{
					scaleLabel: { display: true, labelString: "meters" },
					ticks: { maxTicksLimit: 20 }
				}]
			}
		}
	};
};

module.exports = {
	async renderChart(route) {
		const chartNode = new ChartjsNode(800, 500);
		await chartNode.drawChart(createChartOpts(route));

		return await chartNode.getImageBuffer('image/png');
	}
};
