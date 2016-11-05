"use strict";
importScripts("domlike.js", "potrace.js", "gzip.min.js");
//importScripts("domlike.js", "potrace.js");
{
	{
		let encoder = new TextEncoder("utf-8");
		self.onmessage = function(e){
			var d = e.data;
			try{
				var svg = convertToSVG(
					d.data, d.width, d.height, 
					d.steps, d.params, d.gray, d.responsive, 
					d.weight, d.useFilter, d.curve, d.scale);
				if(d.svgz){
					let gzip = new Zlib.Gzip(encoder.encode(svg));
					var compressed = gzip.compress();
				}
				self.postMessage(
					{svgSource: svg, svgz: compressed},
					compressed ? [compressed.buffer]: undefined
				);
			}catch(e){
				self.postMessage({error: e.toString()});
				//throw(e);
			}
		};
	}
	//progress message
	{
		let total, i;
		var setTotal = function(val){
			total = val;
			i = 0;
		};
		var next = function(){
			self.postMessage({total: total,progress: i++});
		};
	}
	//convert image to SVG
	{
		//color indexes
		let rgb = {r:0, g:1, b:2};
		let grayOnly = {gray: -1};

		//for svg output
		let SVGNS = "http://www.w3.org/2000/svg";
		let XLINK = "http://www.w3.org/1999/xlink";
		let XMLNS = "http://www.w3.org/2000/xmlns"

		let svgTmpl = document.createElementNS(SVGNS, "svg");
		svgTmpl.setAttribute("buffered-rendering", "static");
		svgTmpl.setAttributeNS(XMLNS, "xlink", XLINK);
		let gTmpl = document.createElementNS(SVGNS, "g");
		let descTmpl = document.createElementNS(SVGNS, "desc");
		
		//use filter
		let defsTmpl = document.createElementNS(SVGNS, "defs");
		let useTmpl = document.createElementNS(SVGNS, "use");
		let filterTmpl = document.createElementNS(SVGNS, "filter");
		let feImageTmpl = document.createElementNS(SVGNS, "feImage");
		let feBlendTmpl = document.createElementNS(SVGNS, "feBlend");
		let setSize = function(el, width, height){
			el.setAttribute("x", "0");
			el.setAttribute("y", "0");
			el.setAttribute("width", width);
			el.setAttribute("height", height);
		};
		let createFilter = function(width, height){
			let filter = filterTmpl.cloneNode(false);
			filter.id = "f";
			setSize(filter, width, height);
			filter.setAttribute("filterUnits", "userSpaceOnUse");
			filter.setAttribute("primitiveUnits", "userSpaceOnUse");
			let feImage1 = feImageTmpl.cloneNode(false);
			feImage1.setAttributeNS(XLINK, "href", "#g");
			feImage1.setAttribute("result", "g");
			setSize(feImage1, width, height);
			filter.appendChild(feImage1);
			let feBlend1 = feBlendTmpl.cloneNode(false);
			feBlend1.setAttribute("mode", "screen");
			feBlend1.setAttribute("in", "SourceGraphic");
			feBlend1.setAttribute("in2", "g");
			feBlend1.setAttribute("result", "rg");
			setSize(feBlend1, width, height);
			filter.appendChild(feBlend1);
			let feImage2 = feImageTmpl.cloneNode(false);
			feImage2.setAttributeNS(XLINK, "href", "#b");
			feImage2.setAttribute("result", "b");
			setSize(feImage2, width, height);
			filter.appendChild(feImage2);
			let feBlend2 = feBlendTmpl.cloneNode(false);
			feBlend2.setAttribute("mode", "screen");
			feBlend2.setAttribute("in", "rg");
			feBlend2.setAttribute("in2", "b");
			setSize(feBlend2, width, height);
			filter.appendChild(feBlend2);
			return filter;
		};
		let getColorString = function(color, val){
			var gray = color == "gray";
			return "rgb(" + [
				gray || color == 'r' ? val : 0,
				gray || color == 'g' ? val : 0,
				gray || color == 'b' ? val : 0
			] +")";
		};
		
		var convertToSVG = function(
			data, width, height, 
			osteps, params, gray, responsive, 
			weight, useFilter, curve, scale){
			
			//init asm.js module
			initAsm(data);

			//apply alpha part to RGB
			applyAlpha(data, width, height);

			//construct svg
			var svg = svgTmpl.cloneNode(false);
			if(!responsive){
				svg.setAttribute("width", width*scale + "px");
				svg.setAttribute("height", height*scale + "px");
			}
			svg.setAttribute("viewBox", [0, 0, width, height].join(" "));
			var desc = descTmpl.cloneNode(true);
			desc.textContent = "This file was created by http://www.h2.dion.ne.jp/~defghi/img2svg3/img2svg3.htm at " + (new Date());
			svg.appendChild(desc);
			var defs = defsTmpl.cloneNode(false);
			svg.appendChild(defs);

			//create base svg structure.
			var insertTarget = defs;
			if(gray){
				let use = useTmpl.cloneNode(false);
				use.setAttributeNS(XLINK, "href", "#gray");
				svg.appendChild(use);
			}else if(!useFilter){
				let use = useTmpl.cloneNode(false);
				use.setAttributeNS(XLINK, "href", "#rgb");
				svg.appendChild(use);
				let g = gTmpl.cloneNode(false);
				g.id = "rgb";
				g.style.isolation = "isolate";
				defs.appendChild(g);
				insertTarget = g;
			}else{
				let defs = defsTmpl.cloneNode(false);
				svg.appendChild(defs);
				let filter = createFilter(width, height);
				defs.appendChild(filter);
				let use = useTmpl.cloneNode(false);
				use.setAttributeNS(XLINK, "href", "#r");
				use.style.filter = "url(#f)";
				svg.appendChild(use);
			}
			
			setTotal(gray ? osteps: weight ? osteps * 5: osteps * 3);

			var colors = gray ? grayOnly : rgb;
			for(var color in colors){

				var g = gTmpl.cloneNode(false);
				g.id = color;
				if(!gray && !useFilter){
					g.style.mixBlendMode = "screen";
				}

				let steps = osteps * (weight && (color == 'r' || color == 'g') ? 2 : 1);
				let prevPath;
				let prevBits;
				for(var step = steps; step > 0; step--){
					next();
					
					let bits = new Uint8ClampedArray(data.length);
					bits.set(data);
					//get image bits
					let border = Math.floor(255*Math.pow(step/steps, curve));
					toBit(bits, width, height, colors[color], border, gray);
					//get color string
					let val = Math.floor(255*Math.pow((step-1)/(steps-1), curve));
					let rgb = getColorString(color, val);
					//path created by same bits will cover previous path. 
					if(prevBits && prevBits.every(function(val, i){return val == bits[i];})){
						prevPath.style.fill = rgb;
					}else{
						let path = trace(bits, width, height, params);
						path.style.fill = rgb;
						g.appendChild(path);
						prevPath = path;
						prevBits = bits;
					}
				}
				insertTarget.appendChild(g);
			}
			return svg.toString();
		};
	}
	//manipulate image data array.
	{
		let asm = function(stdin, foreign, heap){
			"use asm";
			var floor = stdin.Math.floor;
			var min = stdin.Math.min;
			var imul = stdin.Math.imul;
			var values = new stdin.Uint8Array(heap);
			//multiply alpha part to rgb values.
			function applyAlpha(len){
				len = len|0;
				var i = 0;
				var pos = 0;
				var alpha = 0.0;
				for(; (i|0)<(len|0); i = (i+1)|0){
					pos = (i * 4)|0;
					alpha = +(values[(pos + 3)|0]|0)/255.0;
					values[pos        ] = ~~floor(+(values[pos        ]|0) * alpha + 255.0 * (1.0 - alpha));
					values[(pos + 1)|0] = ~~floor(+(values[(pos + 1)|0]|0) * alpha + 255.0 * (1.0 - alpha));
					values[(pos + 2)|0] = ~~floor(+(values[(pos + 2)|0]|0) * alpha + 255.0 * (1.0 - alpha));
					values[(pos + 3)|0] = 255;
				}
			}
			//rgb
			function toColorBit(len, color, border){
				len = len|0;
				color = color|0;
				border = border|0;
				var value = 0;
				var i = 0;
				var pos = 0;
				var pic = 0;
				for(; (i|0)<(len|0); i = (i+1)|0){
					pos = (i * 4)|0;
					pic = values[(pos + color)|0]|0;
					values[pos] 
					= values[(pos + 1)|0] 
					= values[(pos + 2)|0] = ((pic|0) <= (border|0)) ? 0: 255;
				}
			}
			//gray
			function toGrayBit(len, color, border){
				len = len|0;
				color = color|0;
				border = border|0;
				var value = 0;
				var i = 0;
				var pos = 0;
				var pic = 0;
				var r = 0, g = 0, b = 0;
				for(; (i|0)<(len|0); i = (i+1)|0){
					pos = (i * 4)|0;
					r = values[pos]|0;
					g = values[(pos+1)|0]|0;
					b = values[(pos+2)|0]|0;
					pic = min(~~floor((+(r|0)) * 0.213 + (+(g|0)) * 0.715 + (+(b|0)) * 0.072), 255)|0;
					values[pos] 
					= values[(pos + 1)|0] 
					= values[(pos + 2)|0] = ((pic|0) <= (border|0)) ? 0: 255;
				}
			}
			return {
				applyAlpha: applyAlpha,
				toColorBit: toColorBit, 
				toGrayBit: toGrayBit
			};
		}
		let buffer;
		let asmmod;
		let unit = 0x10000;
		var initAsm = function(data){
			if(!buffer || buffer.length < data.length){
				buffer = new Uint8Array(
					unit * Math.pow(2, Math.ceil(Math.log2(data.length/unit))));
				asmmod = asm(self, null, buffer.buffer);
			}
		}
		var applyAlpha = function(data, width, height){
			buffer.set(data);
			asmmod.applyAlpha(data, width * height);
			data.set(buffer.slice(0, data.length));
		};
		var toBit = function(data, width, height, color, border, gray){
			var len = width * height;
			buffer.set(data);
			asmmod[gray ? "toGrayBit" : "toColorBit"](len, color, border);
			data.set(buffer.slice(0, data.length));
		};
	}
	//call potrace.
	function trace(data, width, height, params){
		Potrace.setParam(params);
		return Potrace.trace(data, width, height).toPathElement();
	};
}
