# WebSpeechAnalyzer
Try phoneme analyzer demo at: [tabahi.github.io/WebSpeechAnalyzer/](https://tabahi.github.io/WebSpeechAnalyzer/)

Mel spectrum demo at: [tabahi.github.io/WebSpeechAnalyzer/?mode=2](https://tabahi.github.io/WebSpeechAnalyzer/?mode=2&p=Haendel_Lascia_chi_o_pianga.mp4 )


A JS [Web API](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) based spectrum analyzer for speech and music analysis. It can be used for labeling or feature extraction. There is also an option for training a neural network with ml5js.


## Installation
Prerequisites: [Node.js](https://nodejs.org/en/download/), check versions >12 for `node -v` and >6 for `npm -v`.

Install Webpack using `npm`
```cmd
::(project dir)
cd app_assets

npm init -y
npm install webpack webpack-cli --save-dev

```
If you are creating a webpack project from scratch by just using JS files from `./src` then first initialize a new webpack project by `npx webpack` and create a new `webconfig.js` in project root directory. See instructions [here](https://webpack.js.org/guides/getting-started/#using-a-configuration).

Make any necessary edits in `package.json` then build:
```cmd
npm run build

:: Output: webpack 5.4.0 compiled successfully in 1000 ms

```
This will compile the final JS to `./dist/main.js`. Load this file from any HTML webpage where `SA` is the entry point set in `webpack.config.js`. Call library functions as `SA.play_file_sample(url)`.

## Importing

To call this module from other JS scripts, use require or import:
```javascript
const AudioLauncher = require('./src/FormantAnalyzer/AudioLauncher.js');

/* Configure the Audio Launcher*/

var settings = { offline:false, plot_enable:true, spec_type: 1, process_level: 5, plot_len: 200, f_min: 50, f_max: 4000, N_fft_bins: 256, N_mel_bins: 128, window_width: 25, window_step: 25, pause_length:200, min_seg_length:50, plot_lag:1, pre_norm_gain: 1000, high_f_emph:0.00, slow:true, DB_ID:1, collect:false, ML_en: false};


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
```

## Data collection

Data is collected in the browser's local storage. Chrome has a fixed limited storage of 512KB, firefox has the same but it can be increased if you need to collect and label huge amount of audio samples (>100). [See instructions here to increase the data storage capacity of your browser](https://arty.name/localstorage.html).

To see more details about features, see `function formant_features(formants)` in file `./src/FormantAnalyzer/formants.js`.

The `Segment Formants` and `Phoneme Formants` output modes return 18 features per time frame (~25ms). These 18 features include 3 features of 6 formants; mel-frequency (energy weighted), sum of power of formant across it's (vertical) bandwidth, and the bandwidth span of the formant. The colors at the peak amplitudes of formants in the the plot represent formants f0 to f6 as green, magenta, cyan, orange, purple, purple, purple...

## ML Training

Currently, only the "Segment Features" and "Phoneme Features" are the trainable modes because they output fixed number of features (40) per segment or phoneme. To try different layers see references from [ml5js](https://learn.ml5js.org/#/reference/neural-network?id=defining-custom-layers).

In case, someone wants to use CNN layers with padding / masking etc to work with all other modes, then edit the source in `function train_nn(db_id, label_type, label_name)` in file `neuralmodel.js`.
