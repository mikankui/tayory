"use strict";
//webworker内部でも動作するdomオブジェクト似のオブジェクト
//tree構造を作るだけの簡易的なもの．
function domLike(nodeName){
	this.nodeName = nodeName;
	this.attributes = {};
	this.childNodes = [];
}
(function(p){
	p.textContent = "";
	p.setAttribute = function(attName, value){//NOTE:style is not support.
		this.attributes[attName] = value;
	};
	var XLINK = "http://www.w3.org/1999/xlink";
	var XMLNS = "http://www.w3.org/2000/xmlns"
	p.setAttributeNS = function(ns, attName, value){
		if(ns == XLINK){
			this.attributes["xlink:" + attName] = value;
		}else if(ns == XMLNS){
			this.attributes["xmlns:" + attName] = value;
		}
	};
	p.getAttribute = function(attName){//NOTE:style is not support.
		return this.attributes[attName] + "";
	};
	p.getAttributeNS = function(ns, attName){
		if(ns == XLINK){
			return this.attributes["xlink:" + attName];
		}
	};
	p.removeAttribute = function(attName){
		delete this.attributes[attName];
	};
	p.insertBefore = function(el, pt){
		if(el.parentNode){
			el.parentNode.removeChild(el);
		}
		var i = this.childNodes.indexOf(pt);
		if(i < 0){
			this.childNodes.push(el);
		}else{
			this.childNodes.splice(i, 0, el);
		}
		el.parentNode = this;
	};
	p.appendChild = function(node){
		this.insertBefore(node, null);
	};
	p.removeChild = function(node){
		var i = this.childNodes.indexOf(node);
		if(i<0){return;}
		this.childNodes.splice(i, 1);
		node.parentNode = null;
	};
	p.toString = function(){
		var buff = [];
		buff.push("<");
		buff.push(this.nodeName);
		buff.push(getAttributes(this));
		if(this.childNodes.length != 0 || this.textContent != ""){
			buff.push(">");
			buff.push("\n");
			buff.push(getChildNodes(this));
			buff.push(this.textContent);
			buff.push("\n");
			buff.push("</");
			buff.push(this.nodeName);
			buff.push(">");
		}else{
			buff.push("/>");
		}
		return buff.join("");
	};
	function getAttributes(node){
		var attr = node.attributes;
		var buff = [];
		for(var i in attr){
			buff.push(" ");
			buff.push(i);
			buff.push("=\"");
			//style
			buff.push(attr[i].toString ? attr[i].toString(): attr[i]);
			buff.push("\"");
		}
		return buff.join("");
	};
	p.cloneNode = function(){//NOTE:not support true yet.
		var clone = new domLike(this.nodeName);
		for(let i in this.attributes){
			clone.setAttribute(i, this.attributes[i]);
		}
		return clone;
	};
	function getChildNodes(node){
		var children = node.childNodes;
		var buff = [];
		for(var i = 0, len = children.length; i<len; i++){
			buff.push(children[i].toString());
		}
		return buff.join("\n");
	};
	Object.defineProperty(p, "style", {
		get: function(){
			if(!this.attributes["style"]){
				this.attributes["style"] = new styleLike();
			}
			return this.attributes["style"];
		}
	});
	Object.defineProperty(p, "id", {
		set: function(value){
			this.setAttribute("id", value);
		}
	});
	Object.defineProperty(p, "firstChild", {
		get: function(){
			return this.childNodes[0];
		}
	});
	Object.defineProperty(p, "lastChild", {
		get: function(){
			return this.childNodes[this.childNodes.length - 1];
		}
	});
})(domLike.prototype);

//styleオブジェクトをエミュレートする簡易的なインターフェース
function styleLike(){}
(function(p){
	var regex = /[A-Z]/g;
	function replacer(match){
		return "-" + match.toLowerCase();
	}
	function toLcamelToChain(name){
		return name.replace(regex, replacer);
	}
	Object.defineProperty(p, "toString", {
		value: function(){
			var buff = [];
			for(var i in this){
				buff.push(toLcamelToChain(i));
				buff.push(":");
				buff.push(this[i]);
				buff.push(";");
			}
			return buff.join("");
		}
	});
})(styleLike.prototype);

//documentオブジェクトをエミュレートする簡易的なインターフェース
var document = {
	createElement: function(name){
		return new domLike(name);
	},
	createElementNS: function(ns, name){
		var elem = document.createElement(name);
		if(name == "svg"){
			elem.setAttribute("xmlns", ns);
		}
		return elem;
	}
};
