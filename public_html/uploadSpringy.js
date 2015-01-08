/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function startRead_springy() {
  // var starttime = new Date();


    var file = document.getElementById("file").files[0];
    if (file) {
        getAsText(file);
        //alert("Name: " + file.name + "\n" + "Last Modified Date :" + file.lastModifiedDate);
    }
   
    //var endtime = new Date();
  
}
 function getAsText(readFile) {
    var reader = new FileReader();
    reader.readAsText(readFile);
    reader.onload = loaded;
}
function loaded(evt) {
    //alert("File Loaded Successfully");
    var fileString = evt.target.result;
    var startTime = new Date();
    drawgraph(fileString.toString());
    var totalTime=new Date-startTime;
   // console.log(fileString.toString());
   console.log("total time taken is :"+totalTime);
}
function drawgraph(data){
    
    var nodes = [];
var edges=[];
var node=[];
var len = 200;
for (var i = 0; i < len; i++) {
    nodes[i]={data: { id: ''+i , name: i } };
var lines = data.split("\n");
 //console.log(lines);
   for(var k  in lines){
      var node=lines[k].replace('	', ',');
      var node_split=node.split(",");
     
    edges[k]=   { data: { source: ''+node_split[0], target: ''+node_split[1] } };
    
    }


 }
 var options = {
  name: 'springy',

  animate: true, // whether to show the layout as it's running
  maxSimulationTime: 4000, // max length in ms to run the layout
  ungrabifyWhileSimulating: false, // so you can't drag nodes during layout
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // padding on fit
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  random: false, // whether to use random initial positions
  infinite: false, // overrides all other options for a forces-all-the-time mode
  ready: undefined, // callback on layoutready
  stop: undefined, // callback on layoutstop

  // springy forces
  stiffness: 400,
  repulsion: 100000,
  damping: 0.5
};
  
$('#cy').cytoscape(
        {
  style: cytoscape.stylesheet()
    .selector('node')
      .css({
        'content': 'data(name)',
        'text-valign': 'center',
        'text-outline-width': 0.5,
        'text-outline-color': '#888',
        'background-color': 'green',
        'color': '#fff'
      })
    .selector('edge')
      .css({
        'target-arrow-shape': 'triangle',
         'line-color': 'black',
         'source-arrow-color': 'black',
        'target-arrow-color': 'black'
      })
    .selector(':selected')
      .css({
        'background-color': 'black',
        'line-color': 'black',
        'target-arrow-color': 'black',
        'source-arrow-color': 'black'
      })
    .selector('.faded')
      .css({
        'opacity': 0.25,
        'text-opacity': 0
      }), 
  elements: {
    nodes: nodes,
    edges: edges
  },
  
  layout: options,
  
  // on graph initial layout done (could be async depending on layout...)
  ready: function(){
    window.cy = this;
    
    // giddy up...
    
   cy.elements().unselectify();
   cy.userZoomingEnabled( true );
    
    cy.on('tap', 'node', function(e){
      var node = e.cyTarget; 
      var neighborhood = node.neighborhood().add(node);
      
      cy.elements().addClass('faded');
      neighborhood.removeClass('faded');
    });
    
    cy.on('tap', function(e){
      if( e.cyTarget === cy ){
        cy.elements().removeClass('faded');
      }
    });
  }
});

   
}