import * as ChartJS from 'chartjs-node';
import { Route } from './route-fetcher';

interface ChartOpts {
	type: string;
	data: { labels: string[], datasets: object[] };
	options: object;
}

// TODO: are this ok for all values?
const getStepSizeFrom = (distance: number) => {
	if(distance < 140) return 5;
	if(distance < 300) return 10;
	if(distance < 1000) return 25;

	return 50;
};

// TODO: this might not be 100% accurate. I should only render as many points as is
const getHorizontalLabelsFrom = (route: Route) => {
	const labels: string[] = [];

	const pointCount = route.elevationData.points.length;
	for(let i = 0; i <= pointCount; i++) {
		labels.push(Math.round(route.distance * (i / pointCount)).toString());
	}

	return labels;
};

const createChartOpts = (route: Route): ChartOpts  => {
	const labels = getHorizontalLabelsFrom(route); // x axis labels
	const data = route.elevationData.points.map(p => ({ x: p.distance, y: p.elevation }) ); // y-axis
	const stepSize = getStepSizeFrom(route.distance);

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
						min: 0, max: route.distance,
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

export const renderChart = async (route: Route): Promise<Buffer> => {
	const chartNode = new ChartJS(1280, 500);
	await chartNode.drawChart(createChartOpts(route));

	return await chartNode.getImageBuffer('image/png');
}
