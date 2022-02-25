import { Note, Key, ChordType, Chord, Scale, ScaleType } from '@tonaljs/tonal';
import { renderAbc } from 'abcjs';
import { shuffle } from 'lodash';
import { notesListToABCStr, randomListItem } from '.';

export const colors = {
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

export function listInList(a, b) {
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

// random targets
const getChordTarget = (settings) => {

	const scale = Scale.get(`${settings.modeKey} ${settings.scaleMode}`)

	let randomNote
	let validChordTypes


	if (settings.playInModes) {
		const scaleChordTypes = Scale.scaleChords(`${settings.scaleMode}`) 
		const potentialChords =  (() =>{
			let l = []
			for (let i=0; i< scaleChordTypes.length; i++) {
				for (let j=0; j < scale.notes.length; j++) {
					l.push(Chord.get(`${scale.notes[j]} ${scaleChordTypes[i]}`))		
				}
			}
			return l
		})()


		validChordTypes = potentialChords
			.filter(c => notesInNotesChroma(c.notes, scale.notes) )
			.filter(complexityFilter[settings.chordComplexity])
			.filter((c) => c.intervals.length <= parseInt(settings.chordLength))
			// .map((c) => c.aliases[0])
			// .filter(c => !blacklist.includes(c))

		const chosenChord = randomListItem(validChordTypes)
		

		return {
			root: chosenChord.tonic,
			quality: chosenChord.aliases[0],
		}
	}

	else {
		randomNote = randomListItem(settings.chordRoots);
		validChordTypes = ChordType.all() 


		validChordTypes = validChordTypes
			.filter(complexityFilter[settings.chordComplexity])
			.filter((c) => c.intervals.length <= parseInt(settings.chordLength))
			.map((c) => c.aliases[0])
			.filter(c => !blacklist.includes(c))

		const randomType = randomListItem(validChordTypes)

		return {
			root: randomNote,
			quality: randomType,
		};
	}
};

const getScaleTarget = (settings) => {
	let randomNote
	let randomScale
	
	if (settings.playInModes) {
		randomNote = settings.modeKey
		randomScale = settings.scaleMode 
	}
	else {
		randomNote = randomListItem(settings.chordRoots);
		const validScaleTypes = ScaleType.all()

		randomScale = randomListItem(validScaleTypes).name;
	}


	return {
		root: randomNote,
		scale: randomScale,
	};
};


export default class Target {
	static all = []

	static targetsEl = document.querySelector('.targets');

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

		let notes = Chord.get(root + quality).notes

		const newTarget = new Target(TARGET_TYPE_CHORD, root, quality, settings.speed, 
			null, settings.colorProbability, notes);

		Target.all.push(newTarget);

		return newTarget;
	}

	static createArpeggio(settings) {
		const { root, quality } = getChordTarget(settings);


		let notes = Chord.get(root + quality).notes

		const newTarget = new Target(TARGET_TYPE_ARPEGGIO, root, quality, settings.speed, 
			null, settings.colorProbability, notes);

		Target.all.push(newTarget);

		return newTarget;
	}

	static createScale(settings) {
		const { root, scale } = getScaleTarget(settings);

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

	remove() {
		this.el.parentElement.removeChild(this.el);
		Target.all.splice(Target.all.findIndex(t => t.target === this.target), 1)
	}

	static clear() {
		for (let target of Target.all) {
			target.animation.cancel();
			target.remove();
		}
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

		
		// font color
		function hex_is_light(color) {
			const hex = color.replace('#', '');
			const c_r = parseInt(hex.substr(0, 2), 16);
			const c_g = parseInt(hex.substr(2, 2), 16);
			const c_b = parseInt(hex.substr(4, 2), 16);
			const brightness = ((c_r * 299) + (c_g * 587) + (c_b * 114)) / 1000;
			return brightness > 155;
		}
		

		let notes = Chord.get(this.target).notes
		
		// // shuffle notes in chord to get random inversion
		notes = shuffle(notes) 

	

		// 50% chance to draw as colors/ 50% chance as score
		if (Math.random() > 0.5) {
			// remove root
			notes = notes.filter(n => n != tonic)
			// draw as colors
			if (Math.random() < this.colorProbability) { 
				if (hex_is_light(colors[keyEnharnomic])) {
					targetEl.style.color = "#2c3e50"
				} else {
					targetEl.style.color = "#ecf0f1"
				}
				targetEl.style.backgroundColor = colors[keyEnharnomic]

				// add a colored border for every non-root note in chord
				let boxShadow = ""
				
				for (let n=0; n<notes.length; n++) {
					boxShadow = boxShadow + `0 0 0 ${(n+1)*15}px ${colors[Note.enharmonic(notes[n]).toLowerCase()]}, `
				}
				
				// add outside-most black border
				boxShadow = boxShadow + `0 0 0 ${(notes.length*15)-12}px ${'rgb(0, 0, 0, 0.5)'}`

				// boxShadow = boxShadow.slice(0, boxShadow.length-2)
				targetEl.style.boxShadow = boxShadow

				targetEl.style.borderColor = "rgb(0, 0, 0, 0)" // clear border
				targetEl.style.height = "70px"
				targetEl.style.width = "70px"
			
			}
			else {
				targetEl.style.boxShadow = 	`0 0 0 ${3}px ${'rgb(0, 0, 0, 0.5)'}`
			}
		} else {
			let scoreDiv = document.createElement('div')
			scoreDiv.classList.add('targetScoreDiv')


			// draw as score
			var abcString = `X:1\nK:${ Math.random() < 0.33 ? 'C' : Math.random() < 0.33 ? 'clef=bass' : 'clef=alto'}\n[${notesListToABCStr(notes)}]|\n`;

			// add num of cols as parameter to css
			scoreDiv.style +=`;--numCols: ${1};`

			renderAbc(scoreDiv, abcString, {
				add_classes: true, // add css classes to all elements
				scale: 1.5,
			});

			targetEl.appendChild(scoreDiv)
			
			targetEl.style.border = 'medium solid blue'
			targetEl.style.height = targetEl.style.width
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
				Math.random() * (document.body.offsetWidth - targetEl.clientWidth - 850)
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

		if (Math.random() > 0.5) {
			notes = notes.reverse(); 
		}
		
		notes = shuffle(notes)

		// 50% chance to draw as colors and 50% as music score
		if (Math.random () < 0.5) {

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
				targetEl.style.border = 'medium dashed blue'

				targetEl.appendChild(paletteEl)
			}
		} else {
			let scoreDiv = document.createElement('div')
			scoreDiv.classList.add('targetScoreDiv')
			
			// draw as score
			var abcString = `X:1\nK:${ Math.random() < 0.33 ? 'C' : Math.random() < 0.33 ? 'clef=bass' : 'clef=alto'}\n${notesListToABCStr(notes)}|\n`;

			// add num of cols as parameter to css
			scoreDiv.style +=`;--numCols: ${notes.length};`

			renderAbc(scoreDiv, abcString, {
				add_classes: true, // add css classes to all elements
				scale: 1.0,
			});

			targetEl.appendChild(scoreDiv)
			targetEl.style.border = 'medium dashed purple'
		}

	}
}
