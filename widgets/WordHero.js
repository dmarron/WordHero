/**
* Word Hero - an accessible anagram game.  Programmed by David Marron
 */
dojo.provide('myapp.WordHero');
dojo.require('dijit._Widget');
dojo.require('dijit._Templated');
dojo.require('dijit.form.TextBox');
dojo.require('dijit.form.CheckBox');
dojo.require('dojox.timing._base');
dojo.require('dojo.i18n');
dojo.require('dojo.number');
//dojo.require('uow.audio.JSonic');
dojo.requireLocalization('myapp', 'WordHero');

dojo.declare('myapp.WordHero', [dijit._Widget, dijit._Templated], {
    widgetsInTemplate: true,
	templatePath: dojo.moduleUrl('myapp.templates', 'WordHero.html'),

	postCreate: function() {
		var xhrArgs = {
			url: 'wordList.txt',
			handleAs: "text",
			preventCache: true,
			load: dojo.hitch(this,"loadWordList")
		}
		dojo.xhrGet(xhrArgs);
		this.connect(window,'onkeyup','_onKeyPress');
		this.connect(window,'onclick','_onClick');
		dojo.connect(dojo.doc, 'onkeypress', function(event) {
            if(event.target.size === undefined &&
               event.target.rows === undefined &&
               event.keyCode == dojo.keys.BACKSPACE) {
                // prevent backspace page nav
                event.preventDefault();
            }
        } );
		this.introPage();
	},
    postMixInProperties: function() {
		//initialize jsonic from unc open web
		//uow.getAudio({defaultCaching: true}).then(dojo.hitch(this, function(js) { this.js = js; }));
		this.musicNotes = [];
		this.recordedLetters = [];
		this.duplicateLetters = [];
		this.recordedNumbers = [];
		this.recordedMessages = [];
		this._ext = '.mp3';
		this.audioQueue = [];
		this.audioConnections = [];
		this.currentlyTalking = false;
		this.disableTimer = false;
		this.playWithoutTimer = false;
		this.skipLevel = false;
		this.interrupt = false;
		this.wordList = [];
		this.wordString = '';
		this.currentWord = '';
		this.completedWords = [];
		this.scoreThisRound = 0;
		this.score = 0;
		this.STARTING_TIME = 60;
		this.timeLeft = this.STARTING_TIME;
		this.level = 1;
		this.givenLetters = '';
		this.gameStarted = false;
		this.waitNextLevel = false;
		this.typingVar = 0;
		this.mute = false;
		this.noDisable = false;
    },
	loadWordList: function(input) {
		this.wordList = input.split('\n');
		this.wordString = input;
		//I should not have to include this loop but for some reason
		//something strange is being added to the end of each word
		//and making string comparison fail
		for (var i = 0; i < this.wordList.length; i++) {
			//this is a hack to get rid of the last character in every line read from the text file
			//I don't know why I need to do this
			this.wordList[i] = this.wordList[i].substring(0,this.wordList[i].length-1);
		}
	},
	_onClick: function(e) {
		if (!this.gameStarted) {
			//read instructions now
			//this.gameStarted = true;
			//this.generatePage();
		}
	},
	_onKeyPress: function(e) {
		if (!this.gameStarted) {
			//read instructions now
			this.gameStarted = true;
			this.recordedMessages[18].volume = 0;
			//read instructions
			this.audioQueue.push(this.recordedMessages[11]);
			this.audioQueue.push(this.recordedMessages[25]);
			//say level 1
			this.audioQueue.push(this.recordedMessages[19]);
			this.readNumber(this.level,false);
			this.generatePage();
			this.audioQueue.push(this.recordedMessages[22]);
			this.readNumber(800 + this.level*200,false);
			this.audioQueue.push(this.recordedMessages[23]);
		} else if (this.waitNextLevel) {
			if (e.keyCode == 13) {
				this.waitNextLevel = false;
				//interrupt any messages playing
				this.recordedMessages[15].volume = 0;
				this.recordedMessages[16].volume = 0;
				this.audioQueue = [];
				this.currentlyTalking = false;
				this.timeLeft = this.STARTING_TIME;
				this.timeSpan.innerHTML = '<br>Time Left: ' + this.timeLeft + ' seconds<br>';
				this.completedDiv.innerHTML = '<br>Completed Words:<br>';
				this.audioQueue.push(this.recordedMessages[19]);
				this.readNumber(this.level,false);
				this.createNewLetters();
				this.audioQueue.push(this.recordedMessages[22]);
				this.readNumber(800 + this.level*200,false);
				this.audioQueue.push(this.recordedMessages[23]);
			} else {
				this.playMusic();
			}
		} else {
			if (this.recordedMessages[11].volume != 0) {
				this.recordedMessages[11].volume = 0;
			}
			if (this.currentlyTalking || this.audioQueue.length > 0) {
				//interrupt whatever is being said
				//dojo.forEach(this.audioConnections, dojo.disconnect);
				this.audioConnections = [];
				this.audioQueue = [];
				this.currentlyTalking = false;
				this.disableTimer = false;
				this.interrupt = true;
			}
			if (e.keyCode == 13) {
				//Enter pressed
				this.checkWord(this.currentWord);
				this.currentWord = "";
				this.displayMessage.innerHTML = this.currentWord;
			} else if (e.keyCode == 37) {
				//left arrow pressed
				//Read time left
				this.readNumber(this.timeLeft,false);
				this.audioQueue.push(this.recordedMessages[12]);
				this.soundEnded();
			} else if (e.keyCode == 38) {
				//up arrow pressed
				//Say your letters are
				this.audioQueue.push(this.recordedMessages[0]);
				for (i = 0; i < this.givenLetters.length; i++) {
					this.audioQueue.push(this.recordedLetters[this.givenLetters.charCodeAt(i)-65]);
				}
				//this.playAudioQueue();
				this.soundEnded();
			} else if (e.keyCode == 39) {
				//right arrow pressed
				//say you have ... points
				this.audioQueue.push(this.recordedMessages[10]);
				this.readNumber(this.scoreThisRound,true);
				//say you need ... points
				this.audioQueue.push(this.recordedMessages[22]);
				this.readNumber(800 + this.level*200,false);
				this.audioQueue.push(this.recordedMessages[23]);
				this.soundEnded();
			} else if (e.keyCode == 40) {
				//down arrow pressed
				//say you typed...
				this.audioQueue.push(this.recordedMessages[24]);
				for (i = 0; i < this.currentWord.length; i++) {
					this.audioQueue.push(this.recordedLetters[this.currentWord.charCodeAt(i)-65]);
				}
				this.soundEnded();
			} else if (e.keyCode == 8) {
				//backspace pressed
				//say "backspace"
				if (!this.mute) {
					this.recordedMessages[14].play();
				}
				if (this.currentWord.length > 0) {
					this.currentWord = this.currentWord.substring(0,this.currentWord.length-1);
					this.displayMessage.innerHTML = this.currentWord;
				} else {
					//this.playMusic();
				}
			} else if (e.keyCode == 32) {
				//space bar pressed
				//repeat instructions
				this.recordedMessages[11].volume = 1;
				this.audioQueue.push(this.recordedMessages[11]);
				this.audioQueue.push(this.recordedMessages[25]);
				this.soundEnded();
			} else if (e.keyCode == 16) {
				//shift key pressed
				//skip to next level if enough points are earned
				if (this.scoreThisRound >= (800 + this.level*200)) {
					this.skipLevel = true;
				} else {
					this.playMusic();
				}
			} else if (e.keyCode >= 49 && e.keyCode <= 55) {
				//1-7 pressed
				//Read the first through 7th given letter
				if (this.typingVar == 0) {
					if (!this.mute) {
						this.recordedLetters[this.givenLetters[e.keyCode - 49].charCodeAt(0)-65].play();
					}
					this.typingVar = 1;
				} else {
					this.typingVar = 0;
					if (!this.mute) {
						this.duplicateLetters[this.givenLetters[e.keyCode - 49].charCodeAt(0)-65].play();
					}
				}
			} else if (this.givenLetters.indexOf(String.fromCharCode(e.keyCode)) === -1) {
				//check to see if the user has typed one of the given letters.  If not, play a musical note.
				this.playMusic();
			} else {
				if (this.typingVar == 0) {
					if (!this.mute) {
						this.recordedLetters[e.keyCode - 65].play();
					}
					this.typingVar = 1;
				} else {
					this.typingVar = 0;
					if (!this.mute) {
						this.duplicateLetters[e.keyCode - 65].play();
					}
				}
				this.currentWord = this.currentWord + String.fromCharCode(e.keyCode);
				this.displayMessage.innerHTML = this.currentWord;
			}
		}
	},
	//method that I didn't write that connects only once
	onceConnect: function(source, event, object, method){
		source = typeof(source)=="string" ? dojo.byId(source) : source;
		if(!source) throw new Error("Bad source passed to dojo.connect:", source);
		var callback = dojo.hitch(object, method);
		var handle = dojo.connect(source, event, function(){
			callback.apply(object, arguments);
			dojo.disconnect(handle);
		});
		return handle;
	},
	soundEnded: function(value) {
		if (!this.mute) {
			var tDelay = new dojox.timing.Timer();
			tDelay.setInterval(100);
			//console.log('tick');
			tDelay.onTick = dojo.hitch(this,function() {
				this.postSoundEnded(value);
				tDelay.stop();
			});
			tDelay.start();
		}
	},
	postSoundEnded: function(value) {
	//soundEnded: function(value) {
		if (!this.mute) {
			if (!this.currentlyTalking) {
				if (this.audioQueue.length > 0) {
					this.playAudioQueue();
				} else {
					this.disableTimer = false;
				}
			}/* else {
				this.soundEnded();
			}*/
		}
	},
	audioSoundEnded: function(value) {
		//only elements of the audio queue will call this
		if (this.audioQueue.length == 0) {
			this.disableTimer = false;
		}
		if (this.currentlyTalking && !this.interrupt) {
			this.currentlyTalking = false;
			this.playAudioQueue();
		}
	},
	/*playAudioQueue: function(value) {
		var tDelayTwo = new dojox.timing.Timer();
		tDelayTwo.setInterval(Math.floor(Math.random()*50)+50);
		//console.log('tock');
		this.currentlyTalking = false;
		tDelayTwo.onTick = dojo.hitch(this,function() {
			this.postPlayAudioQueue(value);
			tDelayTwo.stop();
		});
		tDelayTwo.start();
	},*/
	//postPlayAudioQueue: function(value) {
	playAudioQueue: function(value) {
		if (this.audioQueue.length > 0 && !this.currentlyTalking) {
			this.currentlyTalking = true;
			/*this.audioConnections[this.audioConnections.length] = */this.onceConnect(this.audioQueue[0], 'ended', this, 'audioSoundEnded');
			this.audioQueue[0].load();
			this.audioQueue[0].play();
			this.disableTimer = true;
			this.interrupt = false;
			//remove the first element of audioQueue
			this.audioQueue.shift();
			if (this.audioQueue.length == 0) {
				this.currentlyTalking = false;
				this.audioConnections = [];
			}
		} else {
			this.disableTimer = false;
		}
	},
	playMusic: function(e) {
		if (!this.mute) {
			var rand = Math.floor(Math.random()*this.musicNotes.length);
			this.musicNotes[rand].volume = 0.3;
			this.musicNotes[rand].play();
		}
	},
	startTimer: function(e) {
		var t = new dojox.timing.Timer();
		t.setInterval(1000);
		t.onTick = dojo.hitch(this,function() {
			if (this.skipLevel) {
				this.skipLevel = false;
				t.stop();
				//go to next level
				this.waitNextLevel = true;
				this.audioQueue = [];
				this.recordedMessages[15].volume = 1;
				this.audioQueue.push(this.recordedMessages[15]);
				this.audioQueue.push(this.recordedMessages[10]);
				this.readNumber(this.score,true);
				this.level++;
			} else if (!this.playWithoutTimer && (!this.disableTimer || this.noDisable)) {
				this.timeLeft --;
				this.timeSpan.innerHTML = '<br>Time Left: ' + this.timeLeft + ' seconds<br>';
				if (this.timeLeft == 30) {
					//Say thirty seconds left
					this.audioQueue.push(this.recordedMessages[13]);
					//this.recordedMessages[13].play();
					//this.playAudioQueue();
					this.soundEnded();
				}
				if (this.timeLeft <= 0) {
					//stop timer
					t.stop();
					//go to next level
					this.waitNextLevel = true;
					if (this.scoreThisRound >= (800 + this.level*200)) {
						this.recordedMessages[15].volume = 1;
						this.audioQueue.push(this.recordedMessages[15]);
						this.audioQueue.push(this.recordedMessages[10]);
						this.readNumber(this.score,true);
						//this.playAudioQueue();
						//if (!this.mute) {
						//	this.recordedMessages[15].play();
						//}
						this.level++;
					} else {
						this.recordedMessages[16].volume = 1;
						this.audioQueue.push(this.recordedMessages[16]);
						this.audioQueue.push(this.recordedMessages[10]);
						this.readNumber(this.score,true);
						//this.playAudioQueue();
						//if (!this.mute) {
						//	this.recordedMessages[16].play();
						//}
						
						this.score = 0;
						this.level = 1;
					}
				}
			}
		});
		t.start();
	},
	checkWord: function(wordToCheck) {
		if (wordToCheck.length < 3) {
			if (wordToCheck.length == 0) {
				//enter has been pressed when no letters have been typed
				this.playMusic();
			} else {
				this.audioQueue.push(this.recordedMessages[4]);
				//this.playAudioQueue();
				this.soundEnded();
				//this.recordedMessages[4].play();
			}
		} else {
			var valid = false;
			//check to see if word is in the list
			for (var i = 0; i < this.wordList.length; i++) {
				if (wordToCheck === this.wordList[i].toUpperCase()) {
					valid = true;
				}
			}
			if (valid) {
				//check to see if word has already been entered
				for (i = 0; i < this.completedWords.length; i++) {
					if (this.completedWords[i] === wordToCheck) {
						this.audioQueue.push(this.recordedMessages[3]);
						//this.playAudioQueue();
						this.soundEnded();
						//this.recordedMessages[3].play();
						valid = false;
					}
				}
				if (valid) {
					//new, valid word, so add it to the player's score
					this.completedWords.push(wordToCheck);
					this.scoreThisRound += (wordToCheck.length*wordToCheck.length+wordToCheck.length)*10;
					this.score += (wordToCheck.length*wordToCheck.length+wordToCheck.length)*10;
					if (wordToCheck.length >= 7) {
						//double the score if the word is 7 or more letters
						this.scoreThisRound += (wordToCheck.length*wordToCheck.length+wordToCheck.length)*10;
						this.score += (wordToCheck.length*wordToCheck.length+wordToCheck.length)*10;
					}
					
					/*if (wordToCheck.length < 10) {
						this.audioQueue.push(this.recordedMessages[wordToCheck.length+2]);
					} else {
						this.audioQueue.push(this.recordedMessages[12]);
					}*/
					this.audioQueue.push(this.recordedMessages[Math.floor(Math.random()*5)+5]);
					this.audioQueue.push(this.recordedMessages[25]);
					//this.audioQueue.push(this.recordedMessages[25]);
					this.audioQueue.push(this.recordedMessages[20]);
					//this.audioQueue.push(this.recordedMessages[25]);
					//this.audioQueue.push(this.recordedMessages[25]);
					this.readNumber((wordToCheck.length*wordToCheck.length+wordToCheck.length)*10,true);
					//this.audioQueue.push(this.recordedMessages[21]);
					//this.playAudioQueue();
					this.soundEnded();
					this.scoreSpan.innerHTML = "<br>Score this round: " + this.scoreThisRound + "<br>Score Needed to Win: " + (800 + this.level*200) + "<br>Total Score: " + this.score + "<br>";
					if (this.scoreThisRound > (800 + this.level*200)) {
						//this.recordedMessages[17].play();
					}
					this.completedDiv.innerHTML = '<br>Completed Words:<br>';
					for (i = 0; i < this.completedWords.length; i++) {
						this.completedDiv.innerHTML += ' ' + this.completedWords[i].toLowerCase();
					}
				}
			} else {
				//say Sorry, ... is not a valid word
				this.audioQueue.push(this.recordedMessages[1]);
				//this.audioQueue.push(this.recordedMessages[25]);
				//this.audioQueue.push(this.recordedMessages[25]);
				//this.audioQueue.push(this.recordedMessages[25]);
				for (i = 0; i < wordToCheck.length; i++) {
					this.audioQueue.push(this.recordedLetters[wordToCheck.charCodeAt(i)-65]);
				}
				this.audioQueue.push(this.recordedMessages[2]);
				//this.playAudioQueue();
				this.soundEnded();
			}
		}
	},
	createNewLetters: function() {
		this.completedWords = [];
		this.currentWord = '';
		this.scoreThisRound = 0;
		var difficulty = [];
		//letters are grouped by difficulty of use
		difficulty[0] = "EAIONRTLD";
		difficulty[1] = "SGBCMPFHU";
		difficulty[2] = "VWYKJXQZ";
		var vowels = "AEIO";
		var length = 7;
		//prevent the same letters appearing multiple times
		var previousLetters = this.givenLetters;
		this.givenLetters = '';
		var numVowels = 0;
		for (var i = 0; i < length; i++) {
			rand = Math.random();
			var diff = 0;
			if (rand > 0.4-0.1/this.level) {
				//~60% chance to get an easy letter
				diff = 0;
			} else if (rand > 0.1-0.1/this.level) {
				diff = 1;
				//~30% chance to get a harder letter
			} else {
				diff = 2;
				//0-10% chance to get a very hard letter (varies by level)
			}
			rand = Math.floor(Math.random() * difficulty[diff].length);
			var newLetter = difficulty[diff].substring(rand,rand+1);
			rand = Math.random();
			if (this.givenLetters.indexOf(newLetter) != -1) {
				i--;
			} else if (vowels.indexOf(newLetter) === -1 && previousLetters.indexOf(newLetter) !== -1 && rand > 0.4) {
				//make it less likely to see consonants from the previous round
				i--;
			} else {
				if (vowels.indexOf(newLetter) !== -1) {
					numVowels++;
				}
				if (numVowels > 3) {
					numVowels--;
					i--;
				} else {
					this.givenLetters += newLetter;
				}
			}
			while (i === length-1 && numVowels < 2) {
				//not enough vowels, so replace a random consonant with a vowel
				rand = Math.floor(Math.random() * vowels.length);
				newLetter = vowels.substring(rand,rand+1);
				while (this.givenLetters.indexOf(newLetter) !== -1) {
					rand = Math.floor(Math.random() * vowels.length);
					newLetter = vowels.substring(rand,rand+1);
				}
				rand = Math.floor(Math.random() * length);
				while (vowels.indexOf(this.givenLetters.charAt(rand)) !== -1) {
					rand = Math.floor(Math.random() * length);
				}
				this.givenLetters = this.givenLetters.replace(this.givenLetters.substring(rand,rand+1),newLetter);
				//this.givenLetters = this.givenLetters.substring(0,rand+1) + newLetter + this.givenLetters.substring(rand+2,this.givenLetters.length);
				numVowels++;
			}
		}
		//if there is a Q without a U, replace the last letter with U
		if (this.givenLetters.indexOf("Q") !== -1 && this.givenLetters.indexOf("U") === -1) {
			this.givenLetters = this.givenLetters.substring(0,this.givenLetters.length-1) + "U";
		}
		
		//say "Your Letters Are"
		this.audioQueue.push(this.recordedMessages[0]);
		for (i = 0; i < this.givenLetters.length; i++) {
			this.audioQueue.push(this.recordedLetters[this.givenLetters.charCodeAt(i)-65]);
		}
		//this.playAudioQueue();
		this.soundEnded();
		this.wordSpan.innerHTML = this.givenLetters;
		this.scoreSpan.innerHTML = "<br>Score this round: " + this.scoreThisRound + "<br>Score Needed to Win: " + (800 + this.level*200) + "<br>Total Score: " + this.score + "<br>";
		this.levelSpan.innerHTML = "Level " + this.level + "<br><br>";
		this.timeLeft = this.STARTING_TIME;
		this.startTimer();
		this.displayMessage.innerHTML = this.currentWord;
		//var re = '/\s[' + this.givenLetters + ']+\s/gi';
		//var re = new RegExp(toRe);
		//var re = /\s[rhnteam]+\s/gi;
		var toRe = '\\s[' + this.givenLetters.toLowerCase() + ']+\\s';
		//toRe = '\\s[rhnteam]+\\s';
		//console.log(this.givenLetters.toLowerCase());
		var re = new RegExp(toRe,"g");
		//console.log(re);
		//console.log(this.wordString.match(re));
	},
	readNumber: function(numberToRead,sayPoints) {
		if (numberToRead <= 20) {
			this.audioQueue.push(this.recordedNumbers[numberToRead]);
			if (sayPoints) {
				this.audioQueue.push(this.recordedMessages[21]);
				this.soundEnded();
			}
		} else {
			var numDigits = numberToRead.toString().length;
			var readArray = []
			//first two digits
			var digitGroup = numberToRead % 100;
			var newEntry = 0;
			if (digitGroup <= 20) {
				if (digitGroup != 0) {
					readArray[0] = digitGroup;
				}
			} else {
				newEntry = numberToRead % 10;
				if (newEntry != 0) {
					readArray.push(newEntry);
				}
				readArray.push(Math.floor(digitGroup/10) + "ty");
			}
			//hundreds digit
			newEntry = Math.floor((numberToRead % 1000)/100);
			if (newEntry != 0) {
				readArray.push(newEntry + " hundred");
			}
			//first two thousands digits
			digitGroup = Math.floor((numberToRead % 100000)/1000);
			if (digitGroup <= 20) {
				if (digitGroup != 0) {
					readArray.push(digitGroup + " thousand");
				}
			} else {
				newEntry = digitGroup % 10;
				if (newEntry != 0) {
					readArray.push(newEntry + " thousand");
					readArray.push(Math.floor(digitGroup/10) + "ty");
				} else {
					readArray.push(Math.floor(digitGroup/10) + "ty" + " thousand");
				}
			}
			//hundred thousands digit
			newEntry = Math.floor((numberToRead % 1000000)/100000);
			if (newEntry != 0) {
				if (digitGroup != 0) {
					readArray.push(newEntry + " hundred");
				} else {
					readArray.push(newEntry + " hundred" + " thousand");
				}
			}
			//first two millions digits
			digitGroup = Math.floor((numberToRead % 100000000)/1000000);
			if (digitGroup <= 20) {
				if (digitGroup != 0) {
					readArray.push(digitGroup + " million");
				}
			} else {
				newEntry = digitGroup % 10;
				if (newEntry != 0) {
					readArray.push(newEntry + " million");
					readArray.push(Math.floor(digitGroup/10) + "ty");
				} else {
					readArray.push(Math.floor(digitGroup/10) + "ty" + " million");
				}
			}
			//hundred millions digit
			newEntry = Math.floor((numberToRead % 1000000000)/100000000)
			if (newEntry != 0) {
				if (digitGroup != 0) {
					readArray.push(newEntry + " hundred");
				} else {
					readArray.push(newEntry + " hundred" + " million");
				}
			}
			for (i = readArray.length-1; i >= 0; i--) {
				if (!isNaN(readArray[i])) {
					this.audioQueue.push(this.recordedNumbers[readArray[i]]);
				} else {
					var elements = readArray[i].split(" ");
					for (j = 0; j < elements.length; j++) {
						if (!isNaN(elements[j])) {
							this.audioQueue.push(this.recordedNumbers[elements[j]]);
						} else {
							if (elements[j].indexOf("ty") != -1) {
								tySplit = elements[j].split("ty")[0];
								this.audioQueue.push(this.recordedNumbers[dojo.number.parse(tySplit)+18]);
							} else if (elements[j].indexOf("hundred") != -1) {
								this.audioQueue.push(this.recordedNumbers[28]);
							} else if (elements[j].indexOf("thousand") != -1) {
								this.audioQueue.push(this.recordedNumbers[29]);
							} else if (elements[j].indexOf("million") != -1) {
								this.audioQueue.push(this.recordedNumbers[30]);
							} else if (elements[j].indexOf("billion") != -1) {
								this.audioQueue.push(this.recordedNumbers[31]);
							}
						}
					}
				}
			}
			if (sayPoints) {
				//this.audioQueue.push(this.recordedMessages[25]);
				this.audioQueue.push(this.recordedMessages[21]);
				this.soundEnded();
			}
			/*for (i = 0; i < numDigits; i++) {
				if (i == 0) {
					console.log(numberToRead % 10);
				} else if (i == 1) {
					console.log(Math.floor((numberToRead % 100)/10) + "ty");
				} else if (i == 2) {
					console.log(Math.floor((numberToRead % 1000)/100) + "hundred");
				} else if (i == 3) {
					console.log(Math.floor((numberToRead % 10000)/1000) + "thousand");
				}
			}*/
		}
	},
	introPage: function(event) {
		dojo.empty(this.generateDiv);
		var lineOne = dojo.doc.createElement('span');
        lineOne.innerHTML = "Welcome to Word Hero<br><br>Press any key to begin";
        dojo.place(lineOne, this.generateDiv);
		
		//code from JSonic that tests what the browser can play
		var node = dojo.create('audio');
        if(node.canPlayType('audio/ogg') && node.canPlayType('audio/ogg') != 'no') {
            this._ext = '.ogg';
        } else if(node.canPlayType('audio/mpeg') && node.canPlayType('audio/mpeg') != 'no') {
            this._ext = '.mp3';
        }
		this.musicNotes = [];
		this.recordedLetters = [];
		this.duplicateLetters = [];
		this.recordedNumbers = [];
		this.recordedMessages = [];
		var cOne = dojo.doc.createElement('audio');
		cOne.setAttribute('src', 'sounds/C1' + this._ext);
		this.musicNotes.push(cOne);
		var cTwo = dojo.doc.createElement('audio');
		cTwo.setAttribute('src', 'sounds/C2' + this._ext);
		this.musicNotes.push(cTwo);
		var cThree = dojo.doc.createElement('audio');
		cThree.setAttribute('src', 'sounds/C3' + this._ext);
		this.musicNotes.push(cThree);
		var dOne = dojo.doc.createElement('audio');
		dOne.setAttribute('src', 'sounds/D1' + this._ext);
		this.musicNotes.push(dOne);
		var dTwo = dojo.doc.createElement('audio');
		dTwo.setAttribute('src', 'sounds/D2' + this._ext);
		this.musicNotes.push(dTwo);
		var eOne = dojo.doc.createElement('audio');
		eOne.setAttribute('src', 'sounds/E1' + this._ext);
		this.musicNotes.push(eOne);
		var eTwo = dojo.doc.createElement('audio');
		eTwo.setAttribute('src', 'sounds/E2' + this._ext);
		this.musicNotes.push(eTwo);
		var fOne = dojo.doc.createElement('audio');
		fOne.setAttribute('src', 'sounds/F1' + this._ext);
		this.musicNotes.push(fOne);
		var fTwo = dojo.doc.createElement('audio');
		fTwo.setAttribute('src', 'sounds/F2' + this._ext);
		this.musicNotes.push(fTwo);
		var gOne = dojo.doc.createElement('audio');
		gOne.setAttribute('src', 'sounds/G1' + this._ext);
		this.musicNotes.push(gOne);
		var gTwo = dojo.doc.createElement('audio');
		gTwo.setAttribute('src', 'sounds/G2' + this._ext);
		this.musicNotes.push(gTwo);
		var aOne = dojo.doc.createElement('audio');
		aOne.setAttribute('src', 'sounds/A1' + this._ext);
		this.musicNotes.push(aOne);
		var aTwo = dojo.doc.createElement('audio');
		aTwo.setAttribute('src', 'sounds/A2' + this._ext);
		this.musicNotes.push(aTwo);
		var bOne = dojo.doc.createElement('audio');
		bOne.setAttribute('src', 'sounds/B1' + this._ext);
		this.musicNotes.push(bOne);
		var bTwo = dojo.doc.createElement('audio');
		bTwo.setAttribute('src', 'sounds/B2' + this._ext);
		this.musicNotes.push(bTwo);
		for (var i = 1; i <= 26; i++) {
			var letteri = dojo.doc.createElement('audio');
			letteri.setAttribute('src', 'sounds/letter' + i + this._ext);
			this.recordedLetters.push(letteri);
		}
		for (var i = 1; i <= 26; i++) {
			var letteri = dojo.doc.createElement('audio');
			letteri.setAttribute('src', 'sounds/letter' + i + this._ext);
			this.duplicateLetters.push(letteri);
		}
		for (var i = 0; i < 32; i++) {
			var numberi = dojo.doc.createElement('audio');
			numberi.setAttribute('src', 'sounds/number' + i + this._ext);
			this.recordedNumbers.push(numberi);
		}
		//(0) Say your letters are
		var yourLettersAre = dojo.doc.createElement('audio');
		yourLettersAre.setAttribute('src', 'sounds/YourLettersAre' + this._ext);
		this.recordedMessages.push(yourLettersAre);
		//(1) Say sorry...
		var sorry = dojo.doc.createElement('audio');
		sorry.setAttribute('src', 'sounds/Sorry' + this._ext);
		this.recordedMessages.push(sorry);
		//(2) Say ... is not a valid word
		var notValidWord = dojo.doc.createElement('audio');
		notValidWord.setAttribute('src', 'sounds/IsNotAValidWord' + this._ext);
		this.recordedMessages.push(notValidWord);
		//(3) Say already used that word
		var alreadyUsedWord = dojo.doc.createElement('audio');
		alreadyUsedWord.setAttribute('src', 'sounds/AlreadyUsedThatWord' + this._ext);
		this.recordedMessages.push(alreadyUsedWord);
		//(4) Say must use at least three letters
		var mustUseThree = dojo.doc.createElement('audio');
		mustUseThree.setAttribute('src', 'sounds/MustUseAtLeastThreeLetters' + this._ext);
		this.recordedMessages.push(mustUseThree);
		//(5-11) Say three-nine letter word
		/*for (i = 3; i <= 9; i++) {
			var letterword = dojo.doc.createElement('audio');
			letterword.setAttribute('src', 'sounds/' + i + 'letterword' + this._ext);
			this.recordedMessages.push(letterword);
		}
		//(12) Say m-m-m-monster word
		var monsterword = dojo.doc.createElement('audio');
		monsterword.setAttribute('src', 'sounds/monsterword' + this._ext);
		this.recordedMessages.push(monsterword);
		*/
		//(5-9) Say an encouraging message
		for (i = 1; i <= 5; i++) {
			var goodjob = dojo.doc.createElement('audio');
			goodjob.setAttribute('src', 'sounds/' + 'good' + i + this._ext);
			this.recordedMessages.push(goodjob);
		}
		//(10) Say you have
		var youhave = dojo.doc.createElement('audio');
		youhave.setAttribute('src', 'sounds/YouHave' + this._ext);
		this.recordedMessages.push(youhave);
		//(11) Instructions
		var instructions = dojo.doc.createElement('audio');
		instructions.setAttribute('src', 'sounds/Instructions' + this._ext);
		this.recordedMessages.push(instructions);
		//(12) Say ... seconds remaining
		var secondsRemaining = dojo.doc.createElement('audio');
		secondsRemaining.setAttribute('src', 'sounds/SecondsRemaining' + this._ext);
		this.recordedMessages.push(secondsRemaining);
		//(13) Say 30 seconds left
		var thirtySecondsLeft = dojo.doc.createElement('audio');
		thirtySecondsLeft.setAttribute('src', 'sounds/30secondsleft' + this._ext);
		this.recordedMessages.push(thirtySecondsLeft);
		//(14) Say backspace
		var outOfTime = dojo.doc.createElement('audio');
		outOfTime.setAttribute('src', 'sounds/backspace' + this._ext);
		this.recordedMessages.push(outOfTime);
		//(15) Say you got enough points
		var gotEnoughPoints = dojo.doc.createElement('audio');
		gotEnoughPoints.setAttribute('src', 'sounds/YouGotEnoughPoints' + this._ext);
		this.recordedMessages.push(gotEnoughPoints);
		//(16) Say sorry, you didn't get enough points
		var notEnoughPoints = dojo.doc.createElement('audio');
		notEnoughPoints.setAttribute('src', 'sounds/NotEnoughPoints' + this._ext);
		this.recordedMessages.push(notEnoughPoints);
		//(17) Say you have enough points to win the level
		var enoughPointsToWin = dojo.doc.createElement('audio');
		enoughPointsToWin.setAttribute('src', 'sounds/YouHaveEnoughPointsToWin' + this._ext);
		this.recordedMessages.push(enoughPointsToWin);
		//(18) Say welcome to word hero
		var welcome = dojo.doc.createElement('audio');
		welcome.setAttribute('src', 'sounds/Welcome' + this._ext);
		this.recordedMessages.push(welcome);
		//(19) Say level
		var level = dojo.doc.createElement('audio');
		level.setAttribute('src', 'sounds/Level' + this._ext);
		this.recordedMessages.push(level);
		//(20) Say thats
		var thats = dojo.doc.createElement('audio');
		thats.setAttribute('src', 'sounds/Thats' + this._ext);
		this.recordedMessages.push(thats);
		//(21) Say points
		var points = dojo.doc.createElement('audio');
		points.setAttribute('src', 'sounds/Points' + this._ext);
		this.recordedMessages.push(points);
		//(22) Say you need
		var youneed = dojo.doc.createElement('audio');
		youneed.setAttribute('src', 'sounds/YouNeed' + this._ext);
		this.recordedMessages.push(youneed);
		//(23) Say points to win this level
		var pointstowin = dojo.doc.createElement('audio');
		pointstowin.setAttribute('src', 'sounds/PointsToWinThisLevel' + this._ext);
		this.recordedMessages.push(pointstowin);
		//(24) Say you typed
		var pointstowin = dojo.doc.createElement('audio');
		pointstowin.setAttribute('src', 'sounds/YouTyped' + this._ext);
		this.recordedMessages.push(pointstowin);
		//(25) Blank recording
		var blank = dojo.doc.createElement('audio');
		blank.setAttribute('src', 'sounds/Blank' + this._ext);
		this.recordedMessages.push(blank);
		//Say instructions:
		//Up - current letters
		//down -typed letters
		//right -score, score needed for round, total score
		//left - time left
		for (i = 0; i < this.recordedLetters.length; i++) {
			//dojo.connect(this.recordedLetters[i], 'ended', this, 'soundEnded');
		}
		for (i = 0; i < this.duplicateLetters.length; i++) {
			//dojo.connect(this.duplicateLetters[i], 'ended', this, 'soundEnded');
		}
		for (i = 0; i < this.recordedNumbers.length; i++) {
			//dojo.connect(this.recordedNumbers[i], 'ended', this, 'soundEnded');
		}
		for (i = 0; i < this.recordedMessages.length; i++) {
			//dojo.connect(this.recordedMessages[i], 'ended', this, 'soundEnded');
		}
		//this.audioQueue.push(this.recordedMessages[18]);
		//this.playAudioQueue();
		this.recordedMessages[18].volume = 0.5;
		this.recordedMessages[18].play();
	},
	generatePage: function(event) {
		//clear all elements
		dojo.empty(this.generateDiv);
		var lineOne = dojo.doc.createElement('span');
        lineOne.innerHTML = "Word Hero<br>";
        dojo.place(lineOne, this.generateDiv);
		this.levelSpan = dojo.doc.createElement('span');
		this.levelSpan.innerHTML = "Level " + this.level + "<br><br>";
		dojo.place(this.levelSpan, this.generateDiv);
		this.wordSpan = dojo.doc.createElement('span');
		dojo.place(this.wordSpan, this.generateDiv);
		var lineBreak = dojo.doc.createElement('span');
		lineBreak.innerHTML = "<br><br>";
		dojo.place(lineBreak, this.generateDiv);
		this.displayMessage = dojo.doc.createElement('span');
		dojo.place(this.displayMessage, this.generateDiv);
		var lineBreakTwo = dojo.doc.createElement('span');
		lineBreakTwo.innerHTML = "<br><br>";
		dojo.place(lineBreakTwo, this.generateDiv);
		//var tempButton = new dijit.form.Button({ label: 'End Level' });
		//this.connect(tempButton, 'onClick', dojo.hitch(this,"createNewLetters"));
		//dojo.place(tempButton.domNode, this.generateDiv);
		this.timeSpan = dojo.doc.createElement('div');
		this.timeSpan.innerHTML = '<br>Time Left: ' + this.timeLeft + ' seconds<br>';
		dojo.place(this.timeSpan, this.generateDiv);
		this.scoreSpan = dojo.doc.createElement('div');
		this.scoreSpan.innerHTML = "<br>Score this round: " + this.scoreThisRound + "<br>Score Needed to Win: " + (800 + this.level*200) + "<br>Total Score: " + this.score + "<br>";
		dojo.place(this.scoreSpan, this.generateDiv);
		this.completedDiv = dojo.doc.createElement('div');
		this.completedDiv.innerHTML = '<br>Completed Words:<br>';
		dojo.place(this.completedDiv, this.generateDiv);
		this.muteBox = new dijit.form.CheckBox({
            name: "muteBox",
            value: "Mute",
			label: "test",
            checked: false,
            onChange: dojo.hitch(this,function() {
				if (!this.mute) {
					this.currentlyTalking = false;
					this.audioQueue = [];
					this.disableTimer = false;
					this.mute = true;
					this.recordedMessages[11].volume = 0;
					this.recordedMessages[15].volume = 0;
					this.recordedMessages[16].volume = 0;
				} else {
					this.mute = false;
				}
            })
        },
        "muteBox");
		this.muteDiv = dojo.doc.createElement('div');
		this.muteDiv.innerHTML = '<br><br>Mute: &nbsp';
		dojo.place(this.muteDiv,dojo.body());
		dojo.place(this.muteBox.domNode,this.muteDiv);
		dojo.place(this.muteDiv,this.generateDiv);
		this.disableBox = new dijit.form.CheckBox({
            name: "disableBox",
            value: "disable",
            checked: false,
            onChange: dojo.hitch(this,function() {
				if (!this.noDisable) {
					this.noDisable = true;
				} else {
					this.noDisable = false;
				}
            })
        },
        "disableBox");
		this.disableDiv = dojo.doc.createElement('div');
		this.disableDiv.innerHTML = "<br>Don't pause timer when speaking: &nbsp";
		dojo.place(this.disableBox.domNode,this.disableDiv);
		dojo.place(this.disableDiv,this.generateDiv);
		this.noTimerBox = new dijit.form.CheckBox({
            name: "checkBox",
            value: "hide all",
            checked: false,
            onChange: dojo.hitch(this,function() {
				if (!this.playWithoutTimer) {
					this.playWithoutTimer = true;
				} else {
					this.playWithoutTimer = false;
				}
            })
        },
        "noTimerBox");
		this.noTimerDiv = dojo.doc.createElement('div');
		this.noTimerDiv.innerHTML = "<br>Play without the timer: &nbsp";
		dojo.place(this.noTimerBox.domNode,this.noTimerDiv);
		dojo.place(this.noTimerDiv,this.generateDiv);
		this.checkBox = new dijit.form.CheckBox({
            name: "checkBox",
            value: "hide all",
            checked: false,
            onChange: dojo.hitch(this,function() {
				if (this.generateDiv.style.visibility == 'hidden') {
					this.generateDiv.style.visibility = 'visible';
				} else {
					this.generateDiv.style.visibility = 'hidden';
				}
            })
        },
        "checkBox");
		this.checkDiv = dojo.doc.createElement('div');
		this.checkDiv.innerHTML = '<br>Hide Game Text: &nbsp';
		dojo.place(this.checkDiv,dojo.body());
		dojo.place(this.checkBox.domNode,this.checkDiv);
		this.instructionsDiv = dojo.doc.createElement('div');
		this.instructionsDiv.innerHTML = "<br>Instructions (Not voice recorded yet):<br>Press enter to submit a word after typing it<br>You can use each letter multiple times in the same word<br>Press 1-7 to read each individual letter or up to repeat all the letters<br>Press shift to skip to the next level if you have enough points"
		dojo.place(this.instructionsDiv,dojo.body());
		this.createNewLetters();
	},
});