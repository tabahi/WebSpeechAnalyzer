
// analyzernode.main.js
let spec_type = 1; //1=mel, 2=power, 3=freq

let window_step = 0.025;
let window_width = 0.040;

let f_min = 50;
let f_max = 4000;
let N_FFT_cut = 256;
let N_mels = 128;
let mel_bins_Hz = [];

let P_GAIN = 1000;

//Autoset variables
let high_f_emph = Math.round(10/N_mels)
let N_FFT_max =  parseInt((sampleRate/f_max)*(N_FFT_cut-1));
let fft_const = -2 * Math.PI / N_FFT_max;
let hconst = 2*Math.PI/(1024 - 1);  //Hamming constant, 1024 is temp window_buff_size
let window_buff_size = 1024; //it will autoset according to the window size
let step_buff_size = 512;
let mel_filters;
let fi = 0;     //current buffer frame index
let WindowsIn = [];
let curInBuff = new Float32Array(step_buff_size);
//let current_window = new Float32Array(window_buff_size);
let lastWindowBuff = new Float32Array(window_buff_size).fill(0);

let analyzer_running = false;
let curInBuff_offset = 0;
let t0_frame = -1;
let t1_frame = -1;

class SpectrumProcessor extends AudioWorkletProcessor {
    constructor () {
      super()
      //last_timestamp = +new Date();
      //console.log(currentFrame)
      //console.log(currentTime)
      analyzer_running = true;
      
      let start_settings = {spec_type: 1, f_min: 50, f_max: 4000, N_fft_bins: 256, N_mel_bins: 128, window_width: 25, window_step: 25, pre_norm_gain: 1000, high_f_emph:0.05, start_frame:-1, end_frame:-1};
      set_settings(start_settings);

    
      this.port.onmessage = (e) => {
            if(e.data.spec_type)
            { 
              this.port.postMessage(set_settings(e.data));
            }
            else if(WindowsIn.length>0)
            {
              let first_window = WindowsIn[0];
              WindowsIn.splice(0,1);

              if(spec_type==1)
              {
                //let mel_bands = get_melbanks(hamming(first_window));
                this.port.postMessage(get_melbanks(hamming(first_window)));
                //mel_bands = null;
              }
              else if(spec_type==2)
              {
                //let power_bands = get_fft(hamming(first_window), 1);
                this.port.postMessage(get_fft(hamming(first_window), 1));
                //power_bands = null;
              }
              else if(spec_type==3)
              {
                //let fft_bands = get_fft(hamming(first_window), 0);
                this.port.postMessage(get_fft(hamming(first_window), 0));
                //fft_bands = null;
              }
              first_window = null;
            }
            else if(e.data==22) //End
            {
              analyzer_running = false;
              
              this.port.postMessage(22);
            }
            else if(e.data==0)    //start
            {
              this.port.postMessage(0);
            }
            else if(e.data!=1)
            {
              console.log("Unrecognized Rx on worklet port");
              console.log(e.data);
            }
      }

    
    }
    
    
    process (inputs, outputs, parameters)
    {
      if(inputs[0][0])  //inputs[0][0] isFloat32Array(128), stream of the channel 0
      {
        //curInBuff = curInBuff.concat(Array.from(inputs[0][0]));
        let in_len = inputs[0][0].length;
        let after_len = curInBuff_offset + in_len;
        if(after_len < step_buff_size)
        {
          curInBuff.set(inputs[0][0], curInBuff_offset);
          curInBuff_offset += in_len;
        }
        else if(after_len == step_buff_size)  //if buffer is exactly full
        {
          curInBuff.set(inputs[0][0], curInBuff_offset);
          this.create_segment(curInBuff);
          curInBuff_offset = 0;
        }
        else          //if buffer overspills
        {
          let split = step_buff_size - curInBuff_offset;
          let this_slice = inputs[0][0].slice(0, split);
          let next_slice = inputs[0][0].slice(split);
          curInBuff.set(this_slice, curInBuff_offset);
          this.create_segment(curInBuff);
          
          curInBuff.set(next_slice, 0);
          curInBuff_offset = next_slice.length; //start next segment
        }
        
      }
      if(analyzer_running)
        return true;
      else
        return false;
    }

    
    create_segment(NewInbuff)
    {
      let current_window = new Float32Array(window_buff_size);

      current_window.set(lastWindowBuff.slice(step_buff_size), 0);
      current_window.set(NewInbuff, window_buff_size - step_buff_size);

      WindowsIn.push(current_window);
      lastWindowBuff = current_window;
      //current_window = new Float32Array(window_buff_size);

      this.port.postMessage(1);
    }

    
  }

let fft_bins_Hz = [];

let power_bins = null;// Float32Array(N_FFT_cut);
let mel_bins = null;//new Uint32Array(N_mels);
let power_bins_2 = null;

function set_settings(this_config)
{
 
  
  //console.log(currentFrame);
  window_width = this_config.window_width/1000;
  window_step = this_config.window_step/1000;
  window_buff_size = parseInt(sampleRate*window_width);
  step_buff_size = parseInt(sampleRate*window_step);

  f_min = this_config.f_min;
  f_max = this_config.f_max;
  
  N_FFT_cut = this_config.N_fft_bins;
  N_FFT_max =  parseInt((sampleRate/f_max)*(N_FFT_cut-1));
  fft_const = -2 * Math.PI / N_FFT_max;
  hconst = 2*Math.PI/(window_buff_size - 1);
  fft_bins_Hz = [];
  for (let i = 0; i < N_FFT_cut; i += 1) //N_FFT_cut, to use only the f_max range
  {
    fft_bins_Hz[i] = Math.round(i*f_max/N_FFT_cut);
  }
  
  N_mels = this_config.N_mel_bins;
  mel_filters = construct_mel_banks(N_FFT_cut, f_max, N_mels, f_min, f_max);
  

  high_f_emph = this_config.high_f_emph;
  P_GAIN = this_config.pre_norm_gain;

  //curInBuff = new Array();
  curInBuff = new Float32Array(step_buff_size);
  //current_window = new Float32Array(window_buff_size);
  lastWindowBuff = new Float32Array(window_buff_size).fill(0);
  fi = 0;
  WindowsIn = [];

  spec_type = this_config.spec_type;

  power_bins = null; mel_bins = null; power_bins_2 = null;
  power_bins = new Float32Array(N_FFT_cut);
  mel_bins = new Uint32Array(N_mels);
  power_bins_2 = new Uint32Array(N_FFT_cut);  //for FFT function

  //var new_window_step = (step_buff_size/sampleRate);
  //var new_window_width = (window_buff_size/sampleRate);


  //console.log("SR:" + String(sampleRate)  + ", WindowSamples:" + String(window_buff_size)  + ", StepSamples:" + String(step_buff_size) + ", t_step:" + String(new_window_step) + ", t_window:" + String(new_window_width) + ", N_FFT_max:" + String(Math.round(N_FFT_max)) + ", N_FFT_cut:" + String(N_FFT_cut) + ", N_mels:" + String(N_mels) + ", f_min:" + String(f_min) + ", f_max:" + String(f_max) + ", StartFrame:" + String(currentFrame))

  var return_bins_Hz = {bins_Hz: fft_bins_Hz}
  if(spec_type==1)
  {
    return_bins_Hz = {bins_Hz: mel_bins_Hz};
  }
  
  return return_bins_Hz;
  
}





function get_melbanks(sig)
{
  const sig_N = sig.length;
  //power_bins = new Float32Array(N_FFT_cut);
  //mel_bins = new Uint32Array(N_mels);

  for (let fbn = 0; fbn < N_FFT_cut; fbn += 1) //N_FFT_cut, to use only the f_max range
  {
    let rex = 0;
    let imx = 0;
    for (let i = 0; i < sig_N; i += 1)
    {
        if (sig[i])
        {
          const rotAngle = fft_const*fbn*i;//-1 * (2 * 3.1416) * fbn * (i / N_FFT_max);
          rex += Math.cos(rotAngle) * sig[i];
          imx += Math.sin(rotAngle) * sig[i];
        }
    }
    var yo = Math.sqrt((rex*rex) + (imx*imx));
    power_bins[fbn] =  P_GAIN * yo * yo;//   /N_FFT_cut;
  }
  
  mel_filters.forEach(function (filter, fIx) {
    
    let tot = 0;
    let emph = 1  + (high_f_emph*fIx);
    power_bins.forEach(function (fp, pIx) {
      tot += fp * filter[pIx];
    });
    tot = tot*emph;
    mel_bins[fIx] = tot;
  });
  //power_bins = null;
  
  return mel_bins;
}




function get_fft(sig, return_power)
{
  const sig_N = sig.length;
  //let power_bins_2 = new Uint32Array(N_FFT_cut);

  for (let fbn = 0; fbn < N_FFT_cut; fbn += 1) //N_FFT_cut, to use only the f_max range
  {
    let rex = 0;
    let imx = 0;
    for (let i = 0; i < sig_N; i += 1)
    {
        if (sig[i])
        {
          const rotAngle = fft_const*fbn*i;//-1 * (2 * 3.1416) * fbn * (i / N_FFT_max);
          rex += Math.cos(rotAngle) * sig[i];
          imx += Math.sin(rotAngle) * sig[i];
        }
    }
    var yo = Math.sqrt((rex*rex) + (imx*imx));
    
    if(!return_power)
      yo =  P_GAIN/100 * yo;
    else
      yo =   100*(P_GAIN/N_FFT_cut) * yo * yo;//   /N_FFT_cut;

    var emph = 1  + (high_f_emph*fbn);
    
    yo = yo*emph;

    power_bins_2[fbn] = yo;

  }
  
  return power_bins_2;
}



function hamming(signal)
{
  let ret = [];
  for (let i = 0; i < signal.length; i += 1)
      ret[i] = (( 0.53836 - ( 0.46164 * Math.cos( hconst *  i ) ) ) * signal[i]);
  return ret;
}


function arrayMin(arr) {
  let len = arr.length, min = Infinity;
  while (len--) {
    if (arr[len] < min) {
      min = arr[len];
    }
  }
  return min;
};

function arrayMax(arr) {
  let len = arr.length, max = -Infinity;
  while (len--) {
    if (arr[len] > max) {
      max = arr[len];
    }
  }
  return max;
};

function arrayAverage(arr){
  let sum = 0;
  let len = arr.length;
  for(let i in arr) {
      sum += arr[i];
  }
  return (sum / len);
};


function get_mel_filters(power_spec_bands)
{
  let ret = new Array(N_mels);

  mel_filters.forEach(function (filter, fIx) {
      var tot = 0;
      power_spec_bands.forEach(function (fp, pIx) {
        tot += fp * filter[pIx];
      });
      ret[fIx] = tot;
    });
  return ret;

}


function mels2Hz(melsxx645) {
  return 700 * (Math.exp(melsxx645 / 1127) - 1);
}

function Hz2mels(hertz653654) {
  return 1127 * Math.log(1 + hertz653654/700);
}

function construct_mel_banks(fftSize, fft_max_freq, nFilters, lowF, highF)
{
  let fftbin = [];
  let filters = [];

  let lowM = Hz2mels(lowF);
  let highM = Hz2mels(highF);
  let delMel = ((highM - lowM) / (parseInt(nFilters)+1));
  //console.log(String(lowM) + ", " + String(highM) + ", " + String(delMel) + ", " + String(nFilters));

  mel_bins_Hz = new Array(nFilters);

  for (let i = 0; i < nFilters; i++) 
  {
    let mel_bin_Hz = mels2Hz(lowM + (i * delMel));  //between lowM and highM.
    fftbin[i] = Math.floor( mel_bin_Hz / (fft_max_freq/fftSize));
    mel_bins_Hz[i] = Math.round(mel_bin_Hz);
  };
  
  
  // one mel cone per fftbin
  for (let i = 0; i < fftbin.length; i++)
  {
    filters[i] = [];
    var filterRange = (i != fftbin.length-1) ? fftbin[i+1] - fftbin[i] : fftbin[i] - fftbin[i-1];
    filters[i].filterRange = filterRange;
    for (let f = 0; f < fftSize; f++)
    {
      if (f > fftbin[i] + filterRange) filters[i][f] = 0.0;
      else if (f > fftbin[i]) filters[i][f] = 1.0 - ((f - fftbin[i]) / filterRange);
      else if (f == fftbin[i]) filters[i][f] = 1.0;
      else if (f >= fftbin[i] - filterRange) filters[i][f] = 1.0 - (fftbin[i] - f) / filterRange;
      else filters[i][f] = 0.0;
    }
  }
  return filters;
}

registerProcessor('spectrum-processor', SpectrumProcessor)


//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
/*

//FFT bins: Sample_Rate / (N_FFT_max + 1) 
let ret = new Array(signal.length);

  for (let i = 0; i < signal.length; i += 1)
  {
    ret[i] = (( 0.53836 - ( 0.46164 * Math.cos( hconst *  i ) ) ) * signal[i]);
  }

let ret = signal.map(function(elm, i) {
  return (( 0.53836 - ( 0.46164 * Math.cos( hconst *  i ) ) ) * elm);
  });
*/

  

/*
  //this.port.postMessage(ci);

  // the sample rate is not going to change ever,
  // because it's a read-only property of a BaseAudioContext
  // and is set only during its instantiation
  //console.log(sampleRate)
  
  // you can declare any variables and use them in you processors
  // for example it may be an ArrayBuffer with a wavetable
  //const usefulVariable = 42
  //console.log(usefulVariable)

curInBuff = curInBuff.concat(Array.from(inputs[0][0]).map(function(element) {
              return element;
              }) );

            const now_time = currentTime;
            const real_srate = parseInt(1/((now_time-last_timestamp)/step_buff_size));
            last_timestamp = now_time;

function complexToAbs(complex_re, complex_im) 
{
    return Math.sqrt (Math.pow(complex_re, 2) + Math.pow(complex_im, 2));
}



function do_dfft(sig)
{
  const N_samples = sig.length;

  let ret = new Array(N_FFT_cut);

  for (let fbn = 0; fbn < N_FFT_cut; fbxx += 1) //N_FFT_cut only within f_max range
  {
    let rex = 0;
    let imx = 0;
    for (let i = 0; i < N_samples; i += 1)
    {
      if(sig[i])
      {
        const rotAngle = fft_const*fbxx*i;//-1 * (2 * 3.1416) * fbxx * (i / N_FFT_max);
        rex += Math.cos(rotAngle) * sig[i];
        imx += Math.sin(rotAngle) * sig[i];
      }
    }

    //fft-magnitude
    //ret[fbxx] = ( Math.sqrt(Math.pow(rex, 2) + Math.pow(imx, 2)) );

    //power spectrum bands
    var yo = Math.sqrt((rex*rex) + (imx*imx));
    ret[fbxx] = ( yo * yo )/N_FFT_cut;

  }
  
  return ret;
}



*/
