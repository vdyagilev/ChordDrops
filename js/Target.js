import { Note, Key, ChordType, Chord } from '@tonaljs/tonal';

const colors = {
	"a": "#e23232",
	"bbb": "#e23232",
	"a#": "#5ca3ff",
	"bb": "#5ca3ff",
	"b": "#ba25f5",
	"b#": "#e3e3e3", 
	"cb": "#ba25f5",
	"c": "#e3e3e3",
	"c#": "#c6f7fd",
	"db": "#c6f7fd", 
	"d": "#45d856",
	"c##": "#45d856",
	"ebb": "#45d856",
	"d#": "#fce61c",
	"eb": "#fce61c",
	"e": "#fa851f",
	"d##": "#fa851f",
	"e#": "#3d3c3c",
	"fb": "#fa851f",
	"f": "#3d3c3c",
	"f#": "#00027a",
	"gb": "#00027a",
	"g": "#6d411a",
	"f##": "#6d411a",
	"abb": "#6d411a",
	"g#": "#961724",
	"ab": "#961724",
	"g##": "#e23232",
}

const complexityFilter = {
	simple: (c) => ['Major', 'Minor'].includes(c.quality) && c.name,
	intermediate: (c) => c.name,
	hard: (c) => c,
};

const getChordTarget = ({
	chordLength = 3,
	chordComplexity = 'simple',
	chordRoots = ['C'],
} = {}) => {
	const randomNote = chordRoots[Math.floor(Math.random() * chordRoots.length)];
	const validChordTypes = ChordType.all()
		.filter(complexityFilter[chordComplexity])
		.filter((c) => c.intervals.length <= parseInt(chordLength))
		.map((c) => c.aliases[0]);
	
	const randomType =
		validChordTypes[Math.floor(Math.random() * validChordTypes.length)];

	return {
		root: randomNote,
		quality: randomType,
	};
};

export default class Target {
	static all = new Map();

	static targetsEl = document.querySelector('.targets');

	static create(settings) {
		const { root, quality } = getChordTarget(settings);

		const existing = Target.all.get(root + quality);
		if (existing) {
			return;
		}

		const newTarget = new Target(root, quality, settings.speed);
		Target.all.set(newTarget.target, newTarget);
		return newTarget;
	}

	static shoot(chord) {
		const found = Target.all.get(chord);
		if (found) {
			found.animation.cancel();
			found.remove();
			return true;
		}
		return false;
	}


	static clear() {
		for (let target of Target.all.values()) {
			target.animation.cancel();
			target.remove();
		}
	}

	constructor(root, quality, speed, onFall) {
		this.root = root;
		this.quality = quality;
		this.target = root + quality;
		this.speed = speed;
		this.render();
		this.invaded = this.animation.finished;
	}

	remove() {
		this.el.parentElement.removeChild(this.el);
		Target.all.delete(this.target);
	}

	async render() {
		const targetEl = document.createElement('div');
		if (this.quality === 'M') {
			targetEl.innerHTML = `<div class="target__root">${this.root}</div>`;
		} else {
			targetEl.innerHTML = `<div class="target__root">${this.root}</div><div class="target__quality">${this.quality}</div>`;
		}
		targetEl.classList.add('target');
		targetEl.style.left =
			Math.floor(
				Math.random() * (document.body.offsetWidth - targetEl.clientWidth - 50)
			) + 'px';
		Target.targetsEl.appendChild(targetEl);
		this.animation = targetEl.animate(
			[
				{ transform: 'translateY(0)' },
				{
					transform: `translateY(calc(100vh - ${targetEl.clientHeight + 2}px)`,
				},
			],
			{
				// timing options
				duration: parseInt(this.speed),
				fill: 'forwards',
			}
		);
		this.el = targetEl;

		// add note specific color

		
		const key = Chord.get(this.target).tonic.toLowerCase();

		targetEl.style.backgroundColor = colors[key]
		// font color
		function hex_is_light(color) {
			const hex = color.replace('#', '');
			const c_r = parseInt(hex.substr(0, 2), 16);
			const c_g = parseInt(hex.substr(2, 2), 16);
			const c_b = parseInt(hex.substr(4, 2), 16);
			const brightness = ((c_r * 299) + (c_g * 587) + (c_b * 114)) / 1000;
			return brightness > 155;
		}
		if (hex_is_light(colors[key])) {
			targetEl.style.color = "#2c3e50"
		} else {
			targetEl.style.color = "#ecf0f1"
		}

		// add a colored border for every non-root note in chord
		let boxShadow = ""
		const notes = Chord.get(this.target).notes
		for (let n=0; n<notes.length; n++) {
			boxShadow = boxShadow + `0 0 0 ${n*10}px ${colors[notes[n].toLowerCase()]}, `
		}
		boxShadow =  boxShadow.slice(0, boxShadow.length-2)

		targetEl.style.boxShadow = boxShadow
	}
}
