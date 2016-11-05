"use strict";
document.addEventListener("DOMContentLoaded", function(){
	var isFF = /firefox/i.test(navigator.userAgent);
	if(isFF){
		document.querySelector("#view").addEventListener("contextmenu", function(e){
			e.preventDefault();
			e.stopPropagation();
		});
	}
	//svg source to downloadable url string.
	{
		let current = "";
		var toURL = function(svgsrc){
			var blob = new Blob([svgsrc], {type: "image/svg+xml"});
			bytes.value = blob.size;
			URL.revokeObjectURL(current);
			current = URL.createObjectURL(blob);
			return current;
		}
	}
	{
		let current = "";
		var toURLz = function(svgz){
			var blob = new Blob([svgz], {type: "image/svg+xml"});
			bytesz.value = blob.size;
			URL.revokeObjectURL(current);
			current = URL.createObjectURL(blob);
			return current;
		}
	}
	//UI
	//trap events on converting.
	{
		var busy = function(state){
			progress.value = 0;
			cover.style.display = state ? "block": "none";
		};
		var isBusy = function(){
			return cover.style.display == "block";
		};
	}
	//load image.
	{
		fileInput.addEventListener("change", function(e){
			if(isBusy()){return;}
			var file = this.files[0];
      if(!file || file.type.indexOf("image")<0){return;}
      display(file);
		});
		source.addEventListener("dragover", function(e){
			e.preventDefault();
		});
		source.addEventListener("drop", function(e){
			if(isBusy()){return;}
			e.stopPropagation();
			e.preventDefault();
			var file = e.dataTransfer.files[0];
      if(!file || file.type.indexOf("image")<0){return;}
      display(file);
		});
		source.addEventListener("load", function(e){
			busy(false);
		});
		source.addEventListener("error", function(e){
			this.removeAttribute("src");
			busy(false);
		});
		let display = function(file){
			obytes.value = file.size;
			URL.revokeObjectURL(source.src);
			busy(true);
			source.src = URL.createObjectURL(file);
		};
	}
	//begin convert
	{
		let canvas = document.createElement("canvas");
		let ctx = canvas.getContext("2d");
		let worker;
		let initWorker = function(){
			if(worker){return;}
			worker = new Worker("img2svg3worker.js");
			worker.addEventListener("message", function(e){
				if(e.data.total){
					progress.value = e.data.progress/e.data.total;
				}
			});
		}
		btnStop.onclick = function(){
			worker.terminate();
			worker = undefined;
			busy(false);
		}
		btnExec.onclick = function(e){
			if(isBusy()){return;}
			if(source.src == ""){return;}
			if(source.naturalWidth * source.naturalHeight > 600 * 600 || selSteps.value > 12){
				if(!confirm("処理に時間がかかるかもしれませんが, よろしいですか?")){
					return;
				}
			}
			busy(true);
			initWorker();
			new Promise(function(resolve, reject){
				canvas.width = source.naturalWidth;
				canvas.height = source.naturalHeight;
				ctx.drawImage(source, 0, 0);
				var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
				worker.onmessage = function(e){
					if(e.data.svgSource){
						resolve(e.data);
					}else if(e.data.error){
						reject(e.data.error);
					}
				}
				worker.postMessage({
					data: data,
					width: canvas.width,
					height: canvas.height,
					steps: selSteps.value,
					params: {
						turdSize: turdSize.value,
						precision: selPrecision.value,
						noFilter: true,
						isRelative: true
					},
					gray: gray.checked,
					responsive: responsive.checked,
					weight: weight.checked,
					useFilter: useFilter.checked,
					curve: curve.value,
					scale: scale.value,
					svgz: needsvgz.checked
				}, [data.buffer]);
			}).then(function(data){
				var objURL = toURL(data.svgSource);
				if(isFF){
					out.src = "data:image/svg+xml;charset=utf-8," 
						+ encodeURIComponent(data.svgSource);
					downloadlink.href = objURL;
				}else{
					out.src = downloadlink.href = view.href = objURL;
				}
				if(data.svgz){
					downloadlinkz.href = toURLz(data.svgz);
				}
				busy(false);
				return;
			}).catch(function(error){
				alert("正常終了しませんでした." + error);
				busy(false);
			});
		};
	}
});
