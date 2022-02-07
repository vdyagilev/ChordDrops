import MIDIInput from './MIDIInput';
import Piano from './Piano';
import Target from './Target';
import { Note, Key, ChordType, Chord } from '@tonaljs/tonal';
import * as Tone from 'tone';

class Game {
	constructor() {
		this.els = {
			currentChord: document.querySelector('.currentChord'),
			targets: document.querySelector('.targets'),
			startButton: document.querySelector('.start-game'),
			level: document.querySelector('.level .value'),
			score: document.querySelector('.score .value'),
			error: document.querySelector('.error'),
			info: document.querySelector('.errorInfo'),
			hearts: document.querySelector('.hearts'),
		};

		this.piano = new Piano();
		this.input = new MIDIInput({
			onChange: this.onChange.bind(this),
			onNoteOn: this.piano.noteOn.bind(this.piano),
			onNoteOff: this.piano.noteOff.bind(this.piano),
			onError: this.onError.bind(this),
		});
		this.els.startButton.addEventListener('click', this.start.bind(this));
		this.createTargetRate = 5000; // start at 5 seconds
		this.gameLoop = null;

		// store last target for displaying in game over
		this.lastTarget = null

		// load game sounds
		this.gameSounds = {
			"success": new Tone.Player("http://localhost:1234/static/sounds/success.mp3").toDestination(),
			"fail": new Tone.Player("http://localhost:1234/static/sounds/fail.mp3").toDestination(),
			"gameover": new Tone.Player("http://localhost:1234/static/sounds/gameover.mp3").toDestination(),
			"levelup": new Tone.Player("http://localhost:1234/static/sounds/levelup.mp3").toDestination(),
			"gong": new Tone.Player("http://localhost:1234/static/sounds/gong.mp3").toDestination()
		}
	}

	start() {
		document.body.classList.add('started');
		this.settings = {
			chordLength: document.querySelector('#chord-length').value,
			chordComplexity: document.querySelector('#chord-complexity').value,
			speed: document.querySelector('#chord-pace').value,
			chordRoots: [
				...document.querySelector('#chord-roots').selectedOptions,
			].map((o) => o.value),
			inversions: document.querySelector('#inversions').value === "Active"
		};
		this.resetScore();
		this.resetLevel();
		this.piano.start();
		this.createTarget();
		this.gameLoop = setTimeout(() => { this.loop() }, this.createTargetRate);

		this.lives = 3
		this.gameSounds.gong.start();
		//this.changeBackgroundColor()
	}

	changeBackgroundColor() {
		const palette = ["#ffadadff", "#ffd6a5ff", "#fdffb6ff", "#caffbfff", "#9bf6ffff",
		 "#a0c4ffff", "#bdb2ffff", "#ffc6ffff",]
		const color = palette[Math.floor((Math.random()*palette.length))]
		document.querySelector('html').style.backgroundColor = color
	}

	async loop() {
		this.createTarget();
		this.gameLoop = setTimeout(() => { this.loop() }, this.createTargetRate);
	}

	async createTarget() {
		try {
			const target = Target.create(this.settings);
			await target.invaded;
			this.lastTarget = target
			this.gameOver();
		} catch (err) { }
	}

	gameOver() {
		// // while lives left decrement and ocn
		// if (this.lives > 0) {
		// 	this.lives--
		// 	break
		// }

		this.gameSounds.gameover.start()

		const lastChord = Chord.get(this.lastTarget.target)

		document.body.classList.remove('started');
		Target.clear();
		this.els.error.textContent = "🎉 Score: " + this.score 
		this.els.info.textContent = "The 💀 chord was " + lastChord.symbol + " [" + lastChord.notes+ "]" +" [" + lastChord.intervals + "]";
		this.resetScore();
		this.resetLevel();
		clearTimeout(this.gameLoop);
	}

	incrementScore() {
		this.score++;
		this.els.score.textContent = this.score;
	}

	resetScore() {
		this.score = 0;
		this.els.score.textContent = this.score;
	}

	incrementLevel() {
		this.gameSounds.levelup.start()

		this.level++;
		this.els.level.textContent = this.level;
		this.createTargetRate = this.createTargetRate * 0.9;
	}

	resetLevel() {
		this.level = 1;
		this.els.level.textContent = this.level;
	}

	onError(error) {
		this.els.startButton.setAttribute('disabled', 'disabled');
		this.els.error.textContent = error;
	}

	async onChange({ notes, chords }) {
		this.els.currentChord.textContent = (chords[0] || '').replace(
			/(.*)M$/,
			'$1'
		);

		function get_inversion(chord) {
			if (!chord.includes("/")) {
				return chord
			}
			function isLetter(c) {
				return c.toLowerCase() != c.toUpperCase();
			}

			const chars = chord.split("/")
			if (isLetter(chars[chars.length - 1])) {
				return chars.slice(0, chars.length - 1).join("");
			} else {
				return chord
			}
		}
		
		var wasHit = false
		for (var c=0; c<chords.length; c++) {
			const chord = chords[c]

			wasHit = Target.shoot(chord) 

			var inversionHit = false
			// shoot all chord inversions too
			if (this.settings.inversions) {
				const inversion = get_inversion(chord)
				inversionHit = Target.shoot(inversion)
			}
			
			if (this.settings.inversions && inversionHit) {
				wasHit = true
			}

			if (wasHit) {
				this.gameSounds.success.start()

				this.incrementScore();
				// Increase createTargetRate by 10% if user scored 10 points
				// Stop increasing when a rate of 100ms is reached
				if (
					this.score > 0 &&
					this.score % 10 == 0 &&
					this.createTargetRate > 100
				) {
					this.incrementLevel();
				}

				break;
			}
		}

		// Lower score if mistake
		if (!wasHit && (notes.length >0 || chords.length > 0)) {
			this.score--;
			this.els.score.textContent = this.score;
		}
		
		// update instrument sound 
	
		if (notes.length >0 || chords.length > 0) {
			// update instrument sound randomly
			if (Math.random() < 0.15) {
				this.piano.instrumentCurrent = this.piano.getRandomInstrument()
			} 
		}
		
	}
}

new Game();
