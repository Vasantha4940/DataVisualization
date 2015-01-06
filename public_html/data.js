/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */



$(function(){ // on dom ready

/*myObject = {}; //myObject[numberline] = "textEachLine";
$.get('Wiki.txt', function(myContentFile) {
   var lines = myContentFile.split("\r\n");

   for(var i  in lines){
      //here your code
      //each line is "lines[i]"

      //save in object "myObject": 
      myObject[i] = lines[i]

      //print in console
      console.log("line " + i + " :" + myObject[i]);
   }
}, 'text');*/
var nodes = [];
var edges=[];
var node=[];
var len = 2;





for (var i = 0; i < len; i++) {
    nodes[i]={data: { id: ''+i , name: i } };
 }
    function readAsText(file) {
        var reader = new FileReader();
        reader.onloadend = function(evt) {
            console.log("Read as text");
            console.log(evt.target.result);
            edges[0]  =   { data: { source: '0', target: '1' } };
            console.log(edges);
        };
        reader.readAsText(file);
    }

/*$.get('sample.txt', function(myContentFile) {
   var lines = myContentFile.split("\n");
  // console.log(lines);
   for(var k  in lines){
      var node=lines[k].replace('	', ',');
      var node_split=node.split(",");
     
    edges[k]=   { data: { source: ''+1, target: ''+3 } };
    
    
   }
}, 'text');*/
//console.log(edges);
edges[0]  =   { data: { source: '0', target: '1' } };
//console.log(edges);

 
$('#cy').cytoscape(
        {
  style: cytoscape.stylesheet()
    .selector('node')
      .css({
        'content': 'data(name)',
        'text-valign': 'center',
        'color': 'white',
        'text-outline-width': 2,
        'text-outline-color': '#888'
      })
    .selector('edge')
      .css({
        'target-arrow-shape': 'triangle'
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
  
  layout: {
    name: 'grid',
    padding: 10
  },
  
  // on graph initial layout done (could be async depending on layout...)
  ready: function(){
    window.cy = this;
    
    // giddy up...
    
    cy.elements().unselectify();
    
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

}); // on dom ready