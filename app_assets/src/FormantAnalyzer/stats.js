
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
