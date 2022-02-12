import MIDIInput from './MIDIInput';
import Piano from './Piano';
import Target from './Target';
import { Note, Key, ChordType, Chord } from '@tonaljs/tonal';
import * as Tone from 'tone';
import abcjs from 'abcjs'
import renderAbc from 'abcjs/src/api/abc_tunebook_svg';

function removeAllChildNodes(parent) {
    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
}

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
			musicScore: document.querySelector('.musicScore'),
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

		this.hearts = 3
		this.heartsStart = 3

		// store all targets on screen in list
		this.targetsOnscreen = []

		// load game sounds
		this.gameSounds = {
			"success": new Tone.Player("http://localhost:1234/static/sounds/success.mp3").toDestination(),
			"fail": new Tone.Player("http://localhost:1234/static/sounds/fail.mp3").toDestination(),
			"gameover": new Tone.Player("http://localhost:1234/static/sounds/gameover.mp3").toDestination(),
			"levelup": new Tone.Player("http://localhost:1234/static/sounds/levelup.mp3").toDestination(),
			"gong": new Tone.Player("http://localhost:1234/static/sounds/gong.mp3").toDestination()
		}
		this.changeBackgroundColor()

		this.gameOn = false
	}

	start() {
		this.gameOn = true;

		document.body.classList.add('started');
		this.settings = {
			chordLength: document.querySelector('#chord-length').value,
			chordComplexity: document.querySelector('#chord-complexity').value,
			speed: document.querySelector('#chord-pace').value,
			chordRoots: [
				...document.querySelector('#chord-roots').selectedOptions,
			].map((o) => o.value),
			inversions: document.querySelector('#inversions').value === "Active",
			colorProbability: document.querySelector('#color-prob').value / 100.0,
			useHearts: document.querySelector('#hearts-checkbox').checked,
		};
		this.resetScore();
		this.resetLevel();
		this.piano.start();
		this.createTarget();
		this.gameLoop = setTimeout(() => { this.loop() }, this.createTargetRate);
		
		this.hearts = this.heartsStart

		this.drawHearts()	

		this.targetsOnscreen = []

		this.gameSounds.gong.start();
		this.changeBackgroundColor()
	}

	changeBackgroundColor() {
		const palette = ["#D5F6DD", "#F9FCE1", "#FEE9B2", "#FBD1B7"]
		const color = palette[Math.floor((Math.random()*palette.length))]
		document.querySelector('html').style.backgroundColor = color
	}


	drawHearts() {
		// update display
		removeAllChildNodes(this.els.hearts) // clear

		if (this.settings.useHearts){
			for (let h=0; h<this.heartsStart; h++) {
				const img = document.createElement('img')
				img.classList.add('heart')
				
				// empty heart
				if (h >= this.hearts) {
					img.src = 'http://localhost:1234/static/images/heart-empty.png'
				} else {
					img.src = 'http://localhost:1234/static/images/heart-filled.png'
				}

				
				this.els.hearts.appendChild(img) // insert
			}
		}
	}
	lowerHearts() {
		if (this.hearts > 0) {
			this.hearts--
			this.drawHearts()

		} 
		if (this.hearts <= 0) {
			this.gameOver()
		}
	}

	async loop() {
		this.createTarget();
		this.gameLoop = setTimeout(() => { this.loop() }, this.createTargetRate);
	}

	async createTarget() {
		try {
			const target = Target.create(this.settings);
			this.targetsOnscreen = this.targetsOnscreen.concat([target.target])

			// upon touching ground game over
			await target.invaded;
			

			this.gameOver()

		} catch (err) { }
	}

	gameOver() {
		this.gameOn = false
		this.gameSounds.gameover.start()

		document.body.classList.remove('started');
		Target.clear();

		this.els.error.textContent = "🎉 Score: " + this.score 

		const lastTarget = this.targetsOnscreen[0]
		const lastChord = Chord.get(lastTarget)
		this.els.info.textContent = "The 💀 chord was " + lastChord.symbol + " [" + lastChord.notes+ "]" +" [" + lastChord.intervals + "]";


		this.resetScore();
		this.resetLevel();
		this.hearts = this.heartsStart
		this.targetsOnscreen = []

		this.createTargetRate = 5000;

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
		this.changeBackgroundColor()

		this.hearts = this.heartsStart
		this.drawHearts()

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
		

		// show chord on music score
		function notesListToABCStr(lst) {
			let x = "" 
			for (let i=0; i<lst.length; i++) {
				let note = lst[i]
				
				// convert accidentals
				while (note.includes('#')) {
					// move accidental to front of note
					note = note.replace('#', '')
					note = '^' + note
				}

				while (note.includes('b')) {
					// move accidental to front of note
					note = note.replace('b', '')
					note = '_' + note
				}

				x = x + note
			}
			return x
		}
		if (notes.length > 0 ) {
			// show name of chord immediatley
			this.els.currentChord.textContent = (chords[0] || '').replace(
				/(.*)M$/,
				'$1'
			);

			var abcString = `X:1\nK:${ Math.random() < 0.33 ? 'C' : Math.random() < 0.33 ? 'clef=bass' : 'clef=alto'}\n[${notesListToABCStr(notes)}]|\n`;

			renderAbc(this.els.musicScore, abcString, {
				add_classes: true, // add css classes to all elements
				scale: 3,
			});
		}

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
		
		if (this.gameOn) {
				
			var wasHit = false
			var hitName = null
			for (var c=0; c<chords.length; c++) {
				const chord = chords[c]

				wasHit = Target.shoot(chord) 
				if (wasHit) {
					hitName = chord
				}

				var inversionHit = false

				// shoot all chord inversions too
				if (this.settings.inversions) {
					const inversion = get_inversion(chord)
					inversionHit = Target.shoot(inversion)

					if (inversionHit) {
						hitName = inversion
					}
				}
				
				if (this.settings.inversions && inversionHit) {
					wasHit = true
				}

				// Successfull hit
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

					// remove from list
					let idx = -1
					for (let t=0; t<this.targetsOnscreen.length; t++) {
						if (this.targetsOnscreen[t] === hitName) {
							// first hit target
							idx = t
							break
						}
					}
					if (idx > -1) {
						// pop
						const hitTarget = this.targetsOnscreen.splice(idx, 1); // 2nd parameter means remove one item only
					}


					break;
				}
			}


			// Subtract a Heart if mistake
			if (!wasHit && (notes.length >0 || chords.length > 0)) {
				if (this.settings.useHearts) {
					this.lowerHearts()
				}
			}
		}
		// update instrument sound 
	
		if (notes.length >0 || chords.length > 0) {
			// update instrument sound randomly
			if (Math.random() < 0.33) {
				this.piano.instrumentCurrent = this.piano.getRandomInstrument()
			} 
		}
		
	}
}

new Game();
