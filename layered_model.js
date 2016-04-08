//@licstart  The following is the entire license notice for the
//JavaScript code in this page.

// Copyright (C) 2016  Stefan Riha (stefan@sriha.net)

//The JavaScript code in this page is free software: you can
//redistribute it and/or modify it under the terms of the GNU
//General Public License (GNU GPL) as published by the Free Software
//Foundation, either version 3 of the License, or (at your option)
//any later version.  The code is distributed WITHOUT ANY WARRANTY;
//without even the implied warranty of MERCHANTABILITY or FITNESS
//FOR A PARTICULAR PURPOSE.  See the GNU GPL for more details.

//As additional permission under GNU GPL version 3 section 7, you
//may distribute non-source (e.g., minimized or compacted) forms of
//that code without the copy of the GNU GPL normally required by
//section 4, provided you include this license notice and a URL
//through which recipients can access the Corresponding Source.

//@licend  The above is the entire license notice
//for the JavaScript code in this page.

// This is a 1.5-layer numerical "ocean" model. It may exhibit numerical
// instabilities. For the real deal, see e.g.
// http://www.gfdl.noaa.gov/him-the-hallberg-isopycnal-model
// https://hycom.org
// Try getting those to work in a web browser:)

window.addEventListener('load', eventWindowLoaded, false);
var id = null;

function eventWindowLoaded() {
  var cs = document.querySelector("canvas")
  var cx = cs.getContext("2d");
  var cw=cs.width; // canvas width
  var ch=cs.height; // canvas height
  cx.translate(0,ch); // flip vert ax
  cx.scale(1,-1);

  lm.draw();

	function loop() {
		lm.stepU()
    lm.stepH()
    lm.draw()
		id=requestAnimationFrame(loop);
	}
	// window.loop=loop; // make it globally available
  id = requestAnimationFrame(loop);
  overcanvas = false;
  bumped = false;
  window.addEventListener('mousemove', mouseaction, false);
}

function mouseaction(e) {
  var cs = document.querySelector("canvas")
  var cx = cs.getContext("2d");
  var cw=cs.width; // canvas width
  var ch=cs.height; // canvas height
  var pos = getMousePos(cs, e);
  posx = pos.x;
  posy = ch-pos.y;
  if (overcanvas & !bumped) {
    if ((posx>0) & (posx<cw)) {
  		if (posy>pos1) {
  			bumped = true;
  			setTimeout(allowbump,1000)
  			lm.bump('up');
  		} else if (posy<pos1) {
  			bumped = true;
  			setTimeout(allowbump,1000)
  			lm.bump('down');
  		}
      pos1=posy;
    }
  }
  if ( (posy > 0.3*ch) & (posy < 0.7*ch) & (posx>0) & (posx<cw) ) {
	   overcanvas=true; pos1=posy;
  } else {
     overcanvas = false;
  }
}

function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
}

function allowbump () {
	// console.log('allowing next bump')
	bumped = false;
}

// layered model. keep everything private: https://www.w3.org/wiki/JavaScript_best_practices#Avoid_globals
var lm = (function(){
  // 1.5-layer model, resting lower layer
  // h is interface height, u is upper layer velocity
  // uhu~~~uhu     staggered grid
  var rg = 0.01; // "reduced gravity"
  var visc = 0.005; // viscosity
  var nx = 11 // number of h-points
  var exphump = 50;
  var x = Array.apply(null, Array(nx)).map(function (x, i) { return i/(nx-1); })
  var h = x.map(function (x, i) { return 0.4+(1-0.4)*Math.exp(-exphump*x*x) })
  var u = Array.apply(null, Array(nx+1)).map(function (x, i) { return 0; })

  function draw() {
    var cs = document.querySelector("canvas")
    var cx = cs.getContext("2d");
    var cw = cs.width; // canvas width
    var ch = cs.height; // canvas height
    cx.beginPath();
    cx.moveTo(0, 0);
    cx.lineTo(cw*x[0], ch*h[0]);
    var len = h.length;
    for (i = 0; i < len; i++) {
      cx.lineTo(cw*x[i+1], ch*h[i+1]);
    }
    cx.lineTo(cw, 0);
    cx.lineTo(0, 0);
    // cx.fillStyle = "#0099ff";
    cx.fillStyle = "#0099ff";
    cx.fill();

    cx.beginPath();
    cx.moveTo(0, ch);
    cx.lineTo(cw*x[0], ch*h[0]);
    var len = h.length;
    for (i = 0; i < len; i++) {
      cx.lineTo(cw*x[i+1], ch*h[i+1]);
    }
    cx.lineTo(cw, ch);
    cx.lineTo(0, ch);
    // cx.fillStyle = "red";
    cx.fillStyle = "#ff5c33";
    cx.fill();
  }

  function stepU() {
    // TODO: remove unnecessary loops
    // Pressure gradient. dhdx is centered at interior u-points
    var dhdx = Array.apply(null, Array(nx-1))
    var len = dhdx.length-1;
    for (i = 0; i <= len; i++) {
      dhdx[i] = h[i+1]-h[i];
    }
    // Nonlinear advection. Correct? Really necessary? Linearized animation
    // looks good enough. Confirm by leaving out dkedx from u equation.
    var ke = Array.apply(null, Array(nx)) // kinetic energy is centered at h-points
    var len = ke.length-1;
    for (i = 0; i <= len; i++) {
      ke[i] = 0.25*(u[i]*u[i]+u[i+1]*u[i+1]);
    }
    var dkedx = Array.apply(null, Array(nx-1)) // dkedx is centered at interior u-points
    var len = dkedx.length-1;
    for (i = 0; i <= len; i++) {
      dkedx[i] = ke[i+1]-ke[i];
    }
    // Friction
    var fr = Array.apply(null, Array(nx-1)) // fr is centered at interior u-points
    var len = u.length-2;
    for (i = 1; i <= len; i++) {
      fr[i-1] = visc*(u[i+1]-2*u[i]+u[i-1])
    }

    // console.log(fr)
    // u[0] = 0; u[u.length-1] = 0;  no normal flux through boundaries
    var len = u.length-2;
    for (i = 1; i <= len; i++) {
      u[i] = u[i]-dkedx[i-1]+rg*dhdx[i-1]+fr[i-1];
    }
  }

  function stepH() {
    // staggering:
    // u h u h u ...
    //     hu  hu ...
    var hu = Array.apply(null, Array(nx-1)) // h at interior u-points
    var len = hu.length-1;
    for (i = 0; i <= len; i++) {
      hu[i] = 0.5*(h[i]+h[i+1]);
    }
    h[0] = h[0] + hu[0]*u[1];
    var len = h.length-2;
    for (i = 1; i <= len; i++) {
      h[i] = h[i]+(hu[i]*u[i+1]-hu[i-1]*u[i]);
    }
    var iend = h.length-1;
    h[iend] = h[iend] - hu[iend-1]*u[iend];
  }

  function bump(direction) {
    var cs = document.querySelector("canvas")
    var cx = cs.getContext("2d");
    var cw=cs.width; // canvas width
    var ch=cs.height; // canvas height
  	var add = x.map(function (x, i) { return 0.4*Math.exp(-exphump*(x-posx/cw)*(x-posx/cw)) })
  	var sum=0
    var len = add.length-1;
  	for (i = 0; i <= len; i++) {
  		sum = sum+add[i];
    }
    var mean = sum/add.length;
    var len = h.length-1;
    if (direction == "up") {
      for (i = 0; i <= len; i++) {
  		    h[i] = h[i]+add[i]-mean;
      }
    } else if (direction == "down") {
      for (i = 0; i <= len; i++) {
  		    h[i] = h[i]-add[i]+mean;
      }
    } else {
      console.log('not implemented')
    }
  }

  return{
    draw:draw,
    stepH:stepH,
    stepU:stepU,
    bump:bump
  }

})();
