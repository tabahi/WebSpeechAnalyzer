

export var solve_poly = function(coeffs, new_x) {

  let ret  = 0;
  for (let c=0; c<coeffs.length;c++)
    ret += coeffs[c] * Math.pow(new_x, c);
  
  return ret;
};

export const mean_std = (arr, usePopulation = false) => {
    const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;
    return [mean, Math.sqrt(
      arr.reduce((acc, val) => acc.concat((val - mean) ** 2), []).reduce((acc, val) => acc + val, 0) /
        (arr.length - (usePopulation ? 0 : 1))
    )];
  };
    

export const only_std = (arr, usePopulation = false) => {
    const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;
    return Math.sqrt(
        arr.reduce((acc, val) => acc.concat((val - mean) ** 2), []).reduce((acc, val) => acc + val, 0) /
        (arr.length - (usePopulation ? 0 : 1))
        );
    };
    
export const only_std_NZ = (arr) => {
    const mean = array_mean_NZ(arr);
    return Math.sqrt(
        arr.reduce((acc, val) => acc.concat((val - mean) ** 2), []).reduce((acc, val) => acc + val, 0) /arr.length
        );
    };
    

export const mean_std_NZ = (arr) => {
    const mean = array_mean_NZ(arr);
    return [mean, Math.sqrt(
        arr.reduce((acc, val) => acc.concat((val - mean) ** 2), []).reduce((acc, val) => acc + val, 0) /arr.length
        )]
    };

export function array_mean_NZ(arr){  //Mean of only non-zeros
    let sum = 0;
    let NZcount = 0;
    for(let i in arr) {
        if(arr[i] > 0)
        {
            sum += arr[i];
            NZcount++;
        }
    }
    return sum/NZcount;
  };


export function arraySum(arr){
    let sum = 0;
    for(let i in arr) {
        sum += arr[i];
    }
    return sum;
  };


export function arrayMax(arr) {
    let len = arr.length, max = -Infinity;
    while (len--) {
      if (arr[len] > max) {
        max = arr[len];
      }
    }
    return max;
};




export const only_mean = (arr) => {
  const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;
  return mean;
};


export function covariance(arr1, arr2) {
  const len1 = arr1.length;
  if(arr1.length != len1) console.error("Unequal samples");
  const arr1_mean = only_mean(arr1);
  const arr2_mean = only_mean(arr2);
  let diff_sum = 0;
  for(let i=0; i<len1; i++)
  {
    diff_sum += (arr1[i] - arr1_mean)*(arr2[i] - arr2_mean)
  }
  diff_sum /= len1;
  
  return diff_sum;
};

export function variance(arr1)
{
  const len1 = arr1.length;
  const arr1_mean = only_mean(arr1);
  let sqr_sum = 0;
  for(let i=0; i<len1; i++)
  {
    sqr_sum += Math.pow(arr1[i] - arr1_mean, 2)
  }
  sqr_sum /= len1;
  
  return sqr_sum;
};

