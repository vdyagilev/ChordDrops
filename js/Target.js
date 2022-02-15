import { Note, Key, ChordType, Chord, Scale, ScaleType } from '@tonaljs/tonal';
import { shuffle } from 'lodash';

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

// avoid these chords
const blacklist = ['b9sus', '69#11']

const TARGET_TYPE_CHORD = "chord"
const TARGET_TYPE_SCALE = "scale"
const TARGET_TYPE_ARPEGGIO = "arpeggio"

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
		.map((c) => c.aliases[0])
		.filter(c => !blacklist.includes(c))


	const randomType =
		validChordTypes[Math.floor(Math.random() * validChordTypes.length)];

	return {
		root: randomNote,
		quality: randomType,
	};
};

const getScaleTarget = ({
	chordRoots = ['C'],
} = {}) => {
	const randomNote = chordRoots[Math.floor(Math.random() * chordRoots.length)];

	const validScaleTypes = ScaleType.all()

	const randomScale =
		validScaleTypes[Math.floor(Math.random() * validScaleTypes.length)];

	return {
		root: randomNote,
		scale: randomScale.name,
	};
};

function randomListItem(items) {
	return items[Math.floor(Math.random()*items.length)];
}

export default class Target {
	static all = []

	static targetsEl = document.querySelector('.targets');

	static create(settings) {
		// create random target from game modes
		let mode = randomListItem(settings.gameModes)
		
		if (mode === TARGET_TYPE_CHORD) {
			return this.createChord(settings)
			
		} else if (mode === TARGET_TYPE_SCALE) {
			const scale = this.createScale(settings)
			return scale

		} else if (mode === TARGET_TYPE_ARPEGGIO) {
			return this.createArpeggio(settings)
		}
	}

	static createChord(settings) {
		const { root, quality } = getChordTarget(settings);

		const existing = Target.all.filter(t => t.target == root + quality);
		if (existing.length > 0) {
			return;
		}
		let notes = Chord.get(root + quality).notes

		const newTarget = new Target(TARGET_TYPE_CHORD, root, quality, settings.speed, 
			null, settings.colorProbability, notes);

		Target.all.push(newTarget);

		return newTarget;
	}

	static createArpeggio(settings) {
		const { root, quality } = getChordTarget(settings);

		const existing = Target.all.filter(t => t.target == root + quality);
		if (existing.length > 0) {
			return;
		}

		let notes = Chord.get(root + quality).notes

		const newTarget = new Target(TARGET_TYPE_ARPEGGIO, root, quality, settings.speed, 
			null, settings.colorProbability, notes);

		Target.all.push(newTarget);

		return newTarget;
	}

	static createScale(settings) {
		const { root, scale } = getScaleTarget(settings);
		const existing = Target.all.filter(t => t.target == scale);
		if (existing.length > 0) {
			return;
		}

		let notes = Scale.get(root + " "  + scale).notes

		const newTarget = new Target(TARGET_TYPE_SCALE, root, scale, settings.speed, 
			null, settings.colorProbability, notes);

		Target.all.push(newTarget);

		return newTarget;
	}

	static shootChord(chord) {
		const found = Target.all.filter(t => t.target === chord)[0];
		if (found) {
			found.animation.cancel();
			found.remove();
			return true;
		}
		return false;
	}

	static shootNotes(notes) {
		const target = Target.all[0]

		function listInList(a, b) {
			// Return true if all elements of a are in b, false otherwise
			for (let i=0; i<a.length; i++) {
				if (!b.includes(a[i])) {
					return false
				}
			}
			return true
		}

		function notesInNotesChroma(a, b) {
			return listInList(
				a.map(n => Note.get(n).chroma),
				b.map(n => Note.get(n).chroma)
			)
		}

		if (target && (target.type == TARGET_TYPE_ARPEGGIO || target.type == TARGET_TYPE_SCALE)) {
			target.notesShot = target.notesShot.concat(notes)

			if (notesInNotesChroma(target.notes, target.notesShot)) {
				target.animation.cancel();
				target.remove();
				return true;
			}
		}
		return false;
	}


	static clear() {
		for (let target of Target.all) {
			target.animation.cancel();
			target.remove();
		}
	}

	constructor(type, root, quality, speed, onFall, colorProbability, notes) {
		this.root = root;
		this.quality = quality;
		this.target = root + quality;
		this.speed = speed;
		this.colorProbability = colorProbability

		// allows Target to be type: "chord", "arpeggio", or "scale"
		this.type = type
		this.notes = notes
		this.notesShot = []

		if (this.type == TARGET_TYPE_CHORD) {
			this.renderChord();
		} else {
			this.renderNotes()
		}
		
		this.invaded = this.animation.finished;
	}

	remove() {
		this.el.parentElement.removeChild(this.el);
		Target.all = Target.all.filter(t => t.target != this.target);
	}

	async renderChord() {
		const targetEl = document.createElement('div');
		if (this.quality === 'M') {
			targetEl.innerHTML = `<div class="target__root">${this.root}</div>`;
		} else {
			targetEl.innerHTML = `<div class="target__root">${this.root}</div><div class="target__quality">${this.quality}</div>`;
		}
		targetEl.classList.add('target');
		targetEl.style.left =
			Math.floor(
				Math.random() * (document.body.offsetWidth - targetEl.clientWidth - 120)
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
			
		const tonic = Chord.get(this.target).tonic
		const keyEnharnomic = Note.enharmonic(tonic).toLowerCase();

		targetEl.style.backgroundColor = colors[keyEnharnomic]
		// font color
		function hex_is_light(color) {
			const hex = color.replace('#', '');
			const c_r = parseInt(hex.substr(0, 2), 16);
			const c_g = parseInt(hex.substr(2, 2), 16);
			const c_b = parseInt(hex.substr(4, 2), 16);
			const brightness = ((c_r * 299) + (c_g * 587) + (c_b * 114)) / 1000;
			return brightness > 155;
		}
		if (hex_is_light(colors[keyEnharnomic])) {
			targetEl.style.color = "#2c3e50"
		} else {
			targetEl.style.color = "#ecf0f1"
		}

		let notes = Chord.get(this.target).notes
		// remove root
		notes = notes.filter(n => n != tonic)
		// shuffle notes in chord to get random inversion
		notes = shuffle(notes) 

		if (Math.random() < this.colorProbability) {
			// add a colored border for every non-root note in chord
			let boxShadow = ""
			
			for (let n=0; n<notes.length; n++) {
				boxShadow = boxShadow + `0 0 0 ${(n+1)*15}px ${colors[Note.enharmonic(notes[n]).toLowerCase()]}, `
			}
			
			// add outside-most black border
			boxShadow = boxShadow + `0 0 0 ${(notes.length*15)-12}px ${'rgb(0, 0, 0, 0.5)'}`

			// boxShadow = boxShadow.slice(0, boxShadow.length-2)
			targetEl.style.boxShadow = boxShadow
		}
		else {
			targetEl.style.boxShadow = 	`0 0 0 ${3}px ${'rgb(0, 0, 0, 0.5)'}`
		}
	}

	async renderNotes() {
		const targetEl = document.createElement('div');
		if (this.quality === 'M') {
			targetEl.innerHTML = `<div class="target__root">${this.root}</div>`;
		} else {
			targetEl.innerHTML = `<div class="target__root">${this.root}</div><div class="target__quality">${this.quality}</div>`;
		}
		targetEl.classList.add('target');
		targetEl.style.left =
			Math.floor(
				Math.random() * (document.body.offsetWidth - targetEl.clientWidth - 450)
			) + 300 + 'px';
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

		// custom styling css : add note specific color

		targetEl.style.borderRadius = '0%' // make square not circle
		targetEl.style.padding = '20px 50px'
			
		let notes = this.notes;
		
		if (Math.random() < this.colorProbability) {
			// make box of colored squares (rep'nting notes ) and render below target name
			const paletteEl = document.createElement('div');
			paletteEl.classList.add('targetNotesPalette')

			for (let n=0; n<notes.length; n++) {
				const note = notes[n]
				const color = colors[Note.enharmonic(note).toLowerCase()]
				//const isHit = this.notesShot.map(n => Note.get(n).chroma).includes(Note.get(note).chroma)

				let noteEl = document.createElement('div');
				noteEl.classList.add('targetPaletteEl')
				noteEl.style.backgroundColor = color

				paletteEl.appendChild(noteEl)			
			}
			
			targetEl.appendChild(paletteEl)
		}
	}
}
