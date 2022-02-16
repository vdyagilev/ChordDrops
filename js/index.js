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
		this.createTargetRateStart = 5000
		this.currentCreateTargetRate = this.createTargetRateStart; // start at 5 seconds
		this.gameLoop = null;

		this.hearts = 3
		this.heartsStart = 3

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
			gameModes: [
				...document.querySelector('#game-modes').selectedOptions,
			].map((o) => o.value),
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
		this.gameLoop = setTimeout(() => { this.loop() }, this.currentCreateTargetRate);
		
		this.hearts = this.heartsStart

		this.drawHearts()	

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
		this.gameLoop = setTimeout(() => { this.loop() }, this.currentCreateTargetRate);
	}

	async createTarget() {
		try {
			const target = Target.create(this.settings);

			// upon touching ground game over
			await target.invaded;
			

			this.gameOver()

		} catch (err) { }
	}

	gameOver() {
		clearTimeout(this.gameLoop);

		this.gameOn = false
		this.gameSounds.gameover.start()

		document.body.classList.remove('started');
		Target.clear();

		this.els.error.textContent = "🎉 Score: " + this.score 

		const lastTarget = Target.all[0]
		const lastChord = Chord.get(lastTarget.target)
		this.els.info.textContent = "The 💀 chord was " + lastChord.symbol + " [" + lastChord.notes+ "]" +" [" + lastChord.intervals + "]";


		this.resetScore();
		this.resetLevel();
		this.hearts = this.heartsStart

		this.currentCreateTargetRate = this.createTargetRateStart
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
		this.currentCreateTargetRate = this.currentCreateTargetRate * 0.95;
	}

	resetLevel() {
		this.level = 1;
		this.els.level.textContent = this.level;
		this.currentCreateTargetRate = this.createTargetRateStart
		
		Target.clear();
		Target.all = []
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
			

			const chars = chord.split("/")
			
			
			const lastChar = chars[chars.length - 1]

			// console.log(`last char: ${lastChar} note: ${Note.get(lastChar).chroma}`)
			
			if (Note.get(lastChar).chroma >= 0) {
				// remove slash chord from chord name 
				return chord.slice(0, -(lastChar.length+1))

			} else {
				return chord
			}
		}
		
		if (this.gameOn) {
				
			let wasHit = false
			
			// Shoot chords
			if (this.settings.gameModes.includes("chord")) {
				for (var c=0; c<chords.length; c++) {
					const chord = chords[c]

					// Check chord given for a hit
					wasHit = Target.shootChord(chord) 
					if (!wasHit) {
						// shoot all chord inversions too
						if (this.settings.inversions) {
							const inversion = get_inversion(chord)
							wasHit = Target.shootChord(inversion)
						}
					}
					// if chord hit then break loop and update game
					if (wasHit) {
						break
					}
				}
			}

			// Shoot notes
			if (!wasHit && this.settings.gameModes.includes("arpeggio")) {
				wasHit = Target.shootNotes(notes) 
			}

			if (!wasHit && this.settings.gameModes.includes("scale")) {
				wasHit = Target.shootNotes(notes)
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
					this.currentCreateTargetRate > 100
				) {
					this.incrementLevel();
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
