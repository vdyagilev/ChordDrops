import { Midi } from '@tonaljs/tonal';
import * as Tone from 'tone';

import { SampleLibrary } from '../tonejs-instruments/Tonejs-Instruments';

export default class Piano {
	constructor() {
		this.display = document.querySelector('.piano');
	}

	start() {
		// default synth sound
		const reverb = new Tone.Reverb().toDestination();
		const filter = new Tone.Filter(500, 'highpass').toDestination();
		this.synth = new Tone.PolySynth().connect(filter).connect(reverb);

		// load tonejs-instruments sounds
		const instruments = ['piano', 'bass-electric', 'bassoon', 'cello', 'clarinet', 'contrabass', 'flute', 'french-horn', 'guitar-acoustic', 'guitar-electric','guitar-nylon', 'harmonium', 'harp', 'organ', 'saxophone', 'trombone', 'trumpet', 'tuba', 'violin', 'xylophone']
        
        const samples = SampleLibrary.load({
            instruments: instruments,
			baseUrl: "http://localhost:1234/static/tonejs-instruments/samples/",
			onload: () => {
				console.log('loaded sounds!'); 
				NProgress.done();
			}
        })
		
		this.instruments = instruments
		this.samples = samples
		this.instrumentCurrent = this.getRandomInstrument()
		
		Tone.start();

		// const sampler = new Tone.Sampler({
		// 	urls: {
		// 		A1: "A1.mp3",
		// 	},
		// 	baseUrl: "https://tonejs.github.io/audio/casio/",
		// 	onload: () => {
		// 		sampler.triggerAttackRelease(["C1", "E1", "G1", "B1"], 0.5);
		// 	}
		// }).toDestination();

	}

	getRandomInstrument() {
		const randIdx = Math.floor(Math.random()*this.instruments.length)
		return this.samples[this.instruments[randIdx]].toDestination();
	}

	noteOn(note) {
		const noteName = Midi.midiToNoteName(note, {
			sharps: true,
		});
		const noteClass = Midi.midiToNoteName(note, {
			pitchClass: true,
			sharps: true,
		});

		// play through instrument
		Tone.Buffer.loaded().then(() => {
			this.instrumentCurrent.triggerAttack(noteName, Tone.now());
		})

		// this.synth.triggerAttack(noteName, Tone.now());

		this.display
			.querySelector(`[data-note="${noteClass}"]`)
			.classList.add('pressed');
	}

	noteOff(note) {
		const noteName = Midi.midiToNoteName(note, {
			sharps: true,
		});
		const noteClass = Midi.midiToNoteName(note, {
			pitchClass: true,
			sharps: true,
		});

		this.instrumentCurrent.triggerRelease(noteName, Tone.now());
		// this.synth.triggerRelease(noteName, Tone.now());

		this.display
			.querySelector(`[data-note="${noteClass}"]`)
			.classList.remove('pressed');
	}
}