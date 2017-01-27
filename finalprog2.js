/* Pablo Dudque */

var canvas;
var gl;

var terrainModel;

var projectionMatrix;
var viewMatrix;
var terrainModelMatrix;

var textureShader;

var modelRotationX = 0;
var modelRotationY = 0;

var dragging = false;

var dX = 0;
var dY = 0;

var xAxis;
var yAxis;
var zAxis;

var compare;

var lastClientX;
var lastClientY;

var heightmapimage;
var meshMatrix;
var terrainTriaglesMatrix;
var modelSize = 256;
var meshFlattened;
var terrainTriaglesFlattened;

function preinit(){

    mycanvas = document.getElementById('webgl');
    gl = getWebGLContext(mycanvas, false);
	var YcomponentGen;
	heightmapimage = new Image();

	heightmapimage.onload = function() {
		YcomponentGen = getHeightData(heightmapimage);
	}

	heightmapimage.crossOrigin = "anonymous";
	heightmapimage.src = "http://i.imgur.com/C5mrWVR.jpg";
    
}
// Having the Y component from the height map, generate the mesh
function generateMesh(Ycomponent){

    var matrix = [];
   

    for (var r = 0; r < modelSize; r++) {
        for (var c = 0; c < modelSize; c++) {
            var newRow = [2*(r/(modelSize-1))-1, Ycomponent[r*modelSize+c], 2*(c/(modelSize-1))-1];
            matrix.push(newRow);
          	
        }
    }
   

    meshMatrix = matrix;

    var triangles = [];

    for (var r = 0; r < modelSize-1; r++) {
        for (var c = 0; c < modelSize-1; c++) {
            var index = r*modelSize+c;
            var triangleOne = [index, index+1, index+modelSize];
            var triangleTwo = [index+1, index+modelSize, index+modelSize+1];
            triangles.push(triangleOne);
            triangles.push(triangleTwo);
        }
    }
    terrainTriaglesMatrix = triangles;
    meshFlattened = new Float32Array(flatten(matrix));
    terrainTriaglesFlattened = new Float32Array(flatten(triangles));

    init();

}

// Analize image to get height points
function getHeightData(img) {

	
    var canvas = document.createElement('canvas');
    canvas.width = modelSize;
    canvas.height = modelSize;
    var context = canvas.getContext('2d');

    var size = modelSize * modelSize
    var data = new Float32Array(size);
  
    context.drawImage(img,0,0);

    for ( var i = 0; i < size; i ++ ) {
        data[i] = 0
    }

    var imgdata = context.getImageData(0, 0, modelSize, modelSize);
    var pixel = imgdata.data;

    var count=0;
    for (var i = 0, n = pixel.length; i < n; i += (4)) {
        var aux = pixel[i]+pixel[i+1]+pixel[i+2];
        data[count++] = aux/3000;
    }
    generateMesh(data);
    

}


// Shader object
function Shader(vertexId, fragmentId){
	this.program = createProgram(gl, document.getElementById(vertexId).text, document.getElementById(fragmentId).text);

	// Get location from unifrom and attributes in our shader

	this.projectionMatrixLocation = gl.getUniformLocation(this.program, "projectionMatrix");
	this.viewMatrixLocation = gl.getUniformLocation(this.program, "viewMatrix");
	this.modelMatrixLocation = gl.getUniformLocation(this.program, "modelMatrix");

	this.lightColorLocation = gl.getUniformLocation(this.program, "lightColor");
	this.modelColorLocation = gl.getUniformLocation(this.program, "modelColor");
	this.lightPositionLocation = gl.getUniformLocation(this.program, "lightPosition");
	
	this.vertexPositionLocation = gl.getAttribLocation(this.program, "vertexPosition");
	this.vertexNormalLocation = gl.getAttribLocation(this.program, "vertexNormal");
	this.vertexTexCoordLocation = gl.getAttribLocation(this.program, "vertexTexCoord")

	// Enable attributes
	
	gl.enableVertexAttribArray(this.vertexPositionLocation);
	gl.enableVertexAttribArray(this.vertexNormalLocation);
	gl.enableVertexAttribArray(this.vertexTexCoordLocation);
	
}
// Use shader
Shader.prototype.use = function(projectionMatrix, viewMatrix, modelMatrix){
	gl.useProgram(this.program);	

	//Give value to all uniform data on our shaders.

	gl.uniformMatrix4fv(this.projectionMatrixLocation, false, projectionMatrix.elements);
	gl.uniformMatrix4fv(this.viewMatrixLocation, false, viewMatrix.elements);
	gl.uniformMatrix4fv(this.modelMatrixLocation, false, modelMatrix.elements);
	gl.uniform3f(this.lightColorLocation, 0.5, 0.5, 0.5);

	
}

// Generate texture coordinates
function generateTexCoords(){
	
	var Yarray = [];
	var Xarray = [];
	var auxY = [];
	for (var i = 0; i < modelSize; i++) {
		for (var ii = 0; ii < modelSize; ii++) {

			var coordx = i/modelSize;
			Xarray.push(coordx);
			var coordy = ii/modelSize;
			Yarray.push(coordy);

		}
	}

	var auxCnt = modelSize*modelSize;
	var meshTextcoords = [];
	for (var i = 0; i < modelSize*modelSize; i++) {
		meshTextcoords.push([Yarray[i], Xarray[auxCnt]]);
		auxCnt--;
	}

	return meshTextcoords;
}

// Load texture
function loadTexture(image, texture){
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	requestAnimationFrame(draw);
}

// Model object
function Model(){
	// Create buffers
	this.positionBuffer = gl.createBuffer();
	this.triangleBuffer = gl.createBuffer();
	this.normalBuffer = gl.createBuffer();
	this.texCoordbuffer = gl.createBuffer();



	// Get data from files and flatten it
	this.positionArray = new Float32Array(flatten(meshMatrix));
	this.normalArray = new Float32Array(flatten(normalCalc2()));
	this.texCoordArray = new Float32Array(flatten(generateTexCoords()));
	this.triangleArray = new Uint16Array(flatten(terrainTriaglesMatrix));
	
	
	console.log(this.positionArray.length);
	console.log(this.normalArray.length);
	console.log(this.triangleArray.length);
	console.log(generateTexCoords().length);


	//Buffer the vertex positions
	gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);	
	gl.bufferData(gl.ARRAY_BUFFER, this.positionArray, gl.STATIC_DRAW);

	//Buffer normals
	gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, this.normalArray, gl.STATIC_DRAW);

	//Buffer texture
	gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordbuffer);
	gl.bufferData(gl.ARRAY_BUFFER, this.texCoordArray, gl.STATIC_DRAW);

	//Buffer the triangles
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangleBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.triangleArray, gl.STATIC_DRAW);

}
// Render model
Model.prototype.render = function(shader){

	// Bind positions buffer and Attrib pointer for positions
	gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);	
	gl.vertexAttribPointer(shader.vertexPositionLocation, 3, gl.FLOAT, gl.FALSE, 0, 0);

	// Bind normals buffer and Attrib pointer for normals
	gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
	gl.vertexAttribPointer(shader.vertexNormalLocation, 3, gl.FLOAT, gl.FALSE, 0, 0);

	// Bind texture buffer and Attrib pointer for texture
	gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordbuffer);
	gl.vertexAttribPointer(shader.vertexTexCoordLocation, 2, gl.FLOAT, false, 0, 0);
	
	// Bind triangle buffer and draw 1
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangleBuffer);
	gl.drawElements(gl.TRIANGLES, this.triangleArray.length, gl.UNSIGNED_SHORT, 0);

}

// Inital set ups, once data is generated
function init(){

	canvas = document.getElementById('webgl');
	gl = getWebGLContext(canvas, false);

	// Initiate our shader and model
	textureShader = new Shader('vertexTextureShader', 'textureShader');
	terrainModel = new Model();

	// Texture initialization
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

	// Create texture
	
	modelTexture = gl.createTexture();

	modelImage = new Image();
	modelImage.onload = function() {
		loadTexture(modelImage, modelTexture);
	}
	
	modelImage.crossOrigin = "anonymous";
	modelImage.src = "http://i.imgur.com/d54l6Tb.jpg";

	// Take care of the model dragging
	canvas.onmousedown = onmousedown;
	canvas.onmouseup = onmouseup;
	canvas.onmousemove = onmousemove;
	
	// Request animation frame
	requestAnimationFrame(draw);

	
}

// Draw and render
function draw() {

	// Create the matrixes for the model, view and projection
	terrainModelMatrix = new Matrix4();
	projectionMatrix = new Matrix4();
	viewMatrix = new Matrix4();

	// Make changes to locate perspective, model and view.
	projectionMatrix.perspective(90, 1 , 1, 10);
	viewMatrix.translate(0, 0, -5);
	terrainModelMatrix.rotate(modelRotationX, 1, 0, 0);
	terrainModelMatrix.rotate(modelRotationY, 0, 1, 0);


	// Enable depth
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.enable(gl.DEPTH_TEST);

	
	// Use our shader and render our model
	textureShader.use(projectionMatrix, viewMatrix, terrainModelMatrix);
	terrainModel.render(textureShader);
}


// Used to flaten matrices
function flatten(a) {
    return a.reduce(function (b, v) { b.push.apply(b, v); return b }, [])
}


// Handle mouse events
function onmousemove(event){
	if (dragging){
		dX = event.clientX - lastClientX;
		dY = event.clientY - lastClientY;

		modelRotationY = modelRotationY + dX;
		modelRotationX = modelRotationX + dY;

		if (modelRotationX > 90.0){
			modelRotationX = 90.0;
		}

		if (modelRotationX < -90.0){
			modelRotationX = -90.0;
		}
	}
	
	lastClientX = event.clientX;
	lastClientY = event.clientY;

	requestAnimationFrame(draw);

}

// Handle mouse events
function onmousedown(event){

	dragging = true;
	lastClientX = event.clientX;
	lastClientY = event.clientY;
}

// Handle mouse events
function onmouseup(event){
	dragging = false;
}



function normalize(a) {
	var len = Math.sqrt(dotProduct(a, a));
	return [
		a[0] / len,
		a[1] / len,
		a[2] / len
	];
}

function dotProduct(a, b){
	return (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
}

function add(a, b) {
	return [
		a[0] + b[0],
		a[1] + b[1],
		a[2] + b[2]
	];
}
function sub(a, b){
	return [
		a[0] - b[0],
		a[1] - b[1],
		a[2] - b[2]
	];
}
function crossProduct(a, b){
	return [
		(a[1] * b[2]) - (a[2] * b[1]),
		(a[2] * b[0]) - (a[0] * b[2]),
		(a[0] * b[1]) - (a[1] * b[0])
	];
}

// Calculate normals for smoothing out models
function normalCalc2(){

    var normals = [];

    for (var i = 0; i < meshMatrix.length; i++) {
        normals.push([0, 0, 0]);
    }

    for (var i = 0; i < terrainTriaglesMatrix.length; i++) {

        var vertexA = normalize(sub(meshMatrix[terrainTriaglesMatrix[i][1]], meshMatrix[terrainTriaglesMatrix[i][0]]));
        var vertexB = normalize(sub(meshMatrix[terrainTriaglesMatrix[i][2]], meshMatrix[terrainTriaglesMatrix[i][0]]));

        var triangleNormal = crossProduct(vertexA, vertexB);

        normals[terrainTriaglesMatrix[i][0]] = add(normals[terrainTriaglesMatrix[i][0]], triangleNormal);
        normals[terrainTriaglesMatrix[i][1]] = add(normals[terrainTriaglesMatrix[i][1]], triangleNormal);
        normals[terrainTriaglesMatrix[i][2]] = add(normals[terrainTriaglesMatrix[i][2]], triangleNormal);
    }

    for (var i = 0; i < normals.length; i++) {
        normals[i] = normalize(normals[i]);
    }

    return normals;
}




