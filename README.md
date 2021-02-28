# WebSpeechAnalyzer
Try phoneme analyzer demo at: [tabahi.github.io/WebSpeechAnalyzer/](https://tabahi.github.io/WebSpeechAnalyzer/)

Mel spectrum demo at: [tabahi.github.io/WebSpeechAnalyzer/?mode=2](https://tabahi.github.io/WebSpeechAnalyzer/?mode=2&p=Haendel_Lascia_chi_o_pianga.mp4 )


A JS [Web API](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) based spectrum analyzer for speech and music analysis. It can be used for labeling or feature extraction. There is also an option for training a neural network with ml5js.


## Installation
Prerequisites: [Node.js](https://nodejs.org/en/download/), check versions >12 for `node -v` and >6 for `npm -v`.

Install Webpack using `npm`
```cmd
::(project dir)
cd Formants-Analyzer

npm init -y
npm install webpack webpack-cli --save-dev

```
If you are creating a webpack project from scratch by just using JS files from `./src` then first initialize a new webpack project by `npx webpack` and create a new `webconfig.js` in project root directory. See instructions [here](https://webpack.js.org/guides/getting-started/#using-a-configuration).

Make any necessary edits in `package.json` then build:
```cmd
npm run build

:: Output: webpack 5.4.0 compiled successfully in 1000 ms

```
This will compile the final JS to `./dist/main.js`. Load this file from any HTML webpage where `FormantAnalyzer` is the entry point set in `webpack.config.js`. Call library functions as `FormantAnalyzer.play_file_sample(url)`.

## Importing

To call this module from other JS scripts, use require or import:
```javascript
const AudioLauncher = require('./src/FormantAnalyzer/AudioLauncher.js');

/* Configure the Audio Launcher*/

var settings = { offline:false,plot_enable:true, spec_type: 1, process_level: 2, plot_len: 200, f_min: 50, f_max: 4000, N_fft_bins: 256, N_mel_bins: 128, window_width: 25, window_step: 25, pause_length:250, min_seg_length:250, plot_lag:1, pre_norm_gain: 1000, high_f_emph:0.0};



AudioLauncher.configure(settings.spec_type, settings.process_level, settings.f_min, settings.f_max, settings.N_fft_bins, settings.N_mel_bins, settings.window_width, settings.window_step, settings.pre_norm_gain, settings.high_f_emph, settings.pause_length, settings.min_seg_length, settings.plot_enable, settings.plot_len, settings.plot_lag, CANVAS_CTX, BOX_WIDTH, BOX_HEIGHT);
/*Can pass null for last 3 parameters if plot_enable is false.*/

var webAudioElement = new Audio("./audio_file.mp3");
/*Parameters:*/
const source = 2;   //1: Local file binary, 2: play from a web Audio, 3: mic
const test_mode = true; //plots only
const offline = false;  //play on speakers
const callback = null;  //don't return extracted features
const tags =[];         //no labels

/* Wait for audio file to load */
webAudioElement.addEventListener("canplaythrough", event => {
    
    /* Launch Audio Nodes */
    AudioLauncher.LaunchAudioNodes(webAudioElement,
                    callback, tags, offline, source, test_mode).then(function()
        {
            console.log("Done");
        }).catch((err)=>{
            console.log(err);
        });
});
