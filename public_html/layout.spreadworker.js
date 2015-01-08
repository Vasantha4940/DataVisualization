;
(function ($$) {

    /*
     * This layout combines several algorithms:
     * 
     * - It generates an initial position of the nodes by using the
     *   Fruchterman-Reingold algorithm (doi:10.1002/spe.4380211102)
     * 
     * - Finally it eliminates overlaps by using the method described by
     *   Gansner and North (doi:10.1007/3-540-37623-2_28)
     */

    var defaults = {
        ready: undefined, // Callback on layoutready 
        stop: undefined, // Callback on layoutstop
        fit: true, // Reset viewport to fit default simulationBounds
        minDist: 20, // Minimum distance between nodes
        padding: 20, // Padding 
        expandingFactor: -1.0, // If the network does not satisfy the minDist
        // criterium then it expands the network of this amount
        // If it is set to -1.0 the amount of expansion is automatically
        // calculated based on the minDist, the aspect ratio and the
        // number of nodes
        maxExpandIterations: 4, // Maximum number of expanding iterations
        simulationBounds: undefined  // [x1, y1, x2, y2]; [0, 0, width, height] by default
    };

    function SpreadLayout(options) {
        this.options = $$.util.extend({}, defaults, options);
    }

    function scriptPath() {
        var scripts = document.getElementsByTagName('SCRIPT');
        var path = '';
        if (scripts && scripts.length > 0) {
            for (var i in scripts) {
                if (scripts[i].src && scripts[i].src.match(/script\.js$/)) {
                    path = scripts[i].src.replace(/(.*)script\.js$/, '$1');
                }
            }
        }
        return path;
    }

    function cellCentroid(cell) {
        var hes = cell.halfedges;
        var area = 0, x = 0, y = 0;
        var p1, p2, f;

        for (var i = 0; i < hes.length; ++i) {
            p1 = hes[i].getEndpoint();
            p2 = hes[i].getStartpoint();

            area += p1.x * p2.y;
            area -= p1.y * p2.x;

            f = p1.x * p2.y - p2.x * p1.y;
            x += (p1.x + p2.x) * f;
            y += (p1.y + p2.y) * f;
        }

        area /= 2;
        f = area * 6;
        return {x: x / f, y: y / f};
    }

    function sitesDistance(ls, rs) {
        var dx = ls.x - rs.x;
        var dy = ls.y - rs.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    SpreadLayout.prototype.run = function () {

        var layout = this;
        var self = this;

        var options = this.options;
        var cy = options.cy;
        var allNodes = cy.nodes();
        var nodes = cy.elements("node:visible");
        //var allEdges = cy.edges();
        var edges = cy.elements("edge:visible");
        var container = cy.container();
        var cWidth = container.clientWidth;
        var cHeight = container.clientHeight;
        var simulationBounds = options.simulationBounds;
        var padding = options.padding;

        layout.trigger({type: 'layoutstart', layout: layout});

        var simBB = {x1: 0, y1: 0, x2: cWidth, y2: cHeight};

        if (simulationBounds) {
            simBB.x1 = simulationBounds[0] + padding;
            simBB.y1 = simulationBounds[1] + padding;
            simBB.x2 = simulationBounds[2] - padding;
            simBB.y2 = simulationBounds[3] - padding;
        } else {
            simBB.x1 = padding;
            simBB.y1 = padding;
            simBB.x2 = cWidth - padding;
            simBB.y2 = cHeight - padding;
        }

        var width = simBB.x2 - simBB.x1;
        var height = simBB.y2 - simBB.y1;

        layout.one("layoutready", options.ready);
        layout.trigger("layoutready");

        // Get start time
        var startTime = new Date();

        // arbor doesn't work with just 1 node
        if (nodes.size() <= 1) {
            if (options.fit) {
                cy.reset();
            }

            nodes.positions({
                x: Math.round((simBB.x1 + simBB.x2) / 2),
                y: Math.round((simBB.y1 + simBB.y2) / 2)
            });

            // Get end time
            var endTime = new Date();
            console.info("Layout on " + nodes.size() + " nodes took " + (endTime - startTime) + " ms");

            layout.one("layoutstop", options.stop);
            layout.trigger("layoutstop");

            return;
        }

        // First I need to create the data structure to pass to the worker
        var pData = {
            'width': width,
            'height': height,
            'minDist': options.minDist,
            'expFact': options.expandingFactor,
            'expIt': 0,
            'maxExpIt': options.maxExpandIterations,
            'vertices': [],
            'edges': [],
            'verticesdiv': [],
            'startTime': startTime
        };
        var fv = [];
        

        //dividing nodes and edges;



        nodes.each(
                function (i, node) {
                    var nodeId = this._private.data.id;
                    pData['vertices'].push({id: nodeId, x: 0, y: 0});
                });


        edges.each(
                function () {
                    var srcNodeId = this.source().id();
                    var tgtNodeId = this.target().id();
                    pData['edges'].push({src: srcNodeId, tgt: tgtNodeId});
                });
        var DivNodes = [];
        nodes.each(
                function (i, node) {
                    var nodeId = this._private.data.id;
                    var found = false;

                    if (DivNodes.length > 0)
                    {
                        DivNodes.forEach(function (node) {
                            if ($.inArray(nodeId, node) > -1)
                            {
                                found = true;
                            }
                        })

                        if (!found) {
                            DivNodes.push(traverse_node(nodeId).sort());
                        }
                    } else {
                        DivNodes.push(traverse_node(nodeId).sort());
                    }

                });
        function traverse_node(nodeId)
        {
            var tempArrNode = [];
            var returned_neigbhours = [];
            var index = 0;
            while (tempArrNode.length >= index && nodeId != undefined)
            {
                returned_neigbhours = jQuery.unique(return_neighbours(nodeId));
                returned_neigbhours.forEach(function (node) {
                    if ($.inArray(node, tempArrNode) == -1)
                    {
                        tempArrNode.push(node)
                    }
                });
                index = index + 1;
                nodeId = tempArrNode[index];
            }
            return tempArrNode;

        }
        function return_neighbours(nodeId)
        {
            var tempArrNode = [];
            tempArrNode.push(nodeId);
            for (i = 0; i < edges.length; i++) {
                var edge = edges[i];
                var srcNodeId = edge.source().id();
                var tgtNodeId = edge.target().id();
                if (srcNodeId == nodeId)
                {
                    tempArrNode.push(tgtNodeId);
                } else if (tgtNodeId == nodeId) {
                    tempArrNode.push(srcNodeId);
                }

            }
            return tempArrNode;
        }
//DIVIDE INTO CORES
        var cores = navigator.hardwareConcurrency;
        while (DivNodes.length > 4)
        {
            DivNodes.sort(function (a, b) {
                return b.length < a.length;
            });
            DivNodes[1] = DivNodes[0].concat(DivNodes[1]);
            DivNodes.shift();
        }
//FORMATE DATA
        DivNodes.forEach(function (node, index) {
            pData['verticesdiv'].push([]);
            node.forEach(function (nodeId) {
                pData['verticesdiv'][index].push({id: nodeId, x: 0, y: 0});
            }
            )
        });
        var t1 = $$.Thread();
        var t2 = $$.Thread();
        var t3 = $$.Thread();
        var t4 = $$.Thread();
        t1.require(sitesDistance);
        t1.require(cellCentroid);
        t2.require(sitesDistance);
        t2.require(cellCentroid);
        t3.require(sitesDistance);
        t3.require(cellCentroid);
        t4.require(sitesDistance);
        t4.require(cellCentroid);
        pData['startTime'] = new Date();
        
       // $$.Promise.all([// both threads done
            t1.pass(pData).run(function (pData) {



                /*
                 * FIRST STEP: Application of the Fruchterman-Reingold algorithm
                 *
                 * We use the version implemented by the foograph library
                 *  
                 * Ref.: https://code.google.com/p/foograph/
                 */
                var foograph = {
                    /**
                     * Insert a vertex into this graph.
                     * 
                     * @param vertex A valid Vertex instance
                     */
                    insertVertex: function (vertex) {
                        this.vertices.push(vertex);
                        this.vertexCount++;
                    },
                    insertVertexdiv: function (vertex) {
                        this.verticesdiv.push(vertex);
                        this.vertexCountdiv++;
                    },
                    /**
                     * Insert an edge vertex1 --> vertex2.
                     *  
                     * @param label Label for this edge
                     * @param weight Weight of this edge
                     * @param vertex1 Starting Vertex instance
                     * @param vertex2 Ending Vertex instance
                     * @return Newly created Edge instance
                     */
                    insertEdge: function (label, weight, vertex1, vertex2, style) {
                        var e1 = new foograph.Edge(label, weight, vertex2, style);
                        var e2 = new foograph.Edge(null, weight, vertex1, null);

                        vertex1.edges.push(e1);
                        vertex2.reverseEdges.push(e2);

                        return e1;
                    },
                    /** 
                     * Delete edge.
                     *
                     * @param vertex Starting vertex
                     * @param edge Edge to remove
                     */
                    removeEdge: function (vertex1, vertex2) {
                        for (var i = vertex1.edges.length - 1; i >= 0; i--) {
                            if (vertex1.edges[i].endVertex == vertex2) {
                                vertex1.edges.splice(i, 1);
                                break;
                            }
                        }

                        for (var i = vertex2.reverseEdges.length - 1; i >= 0; i--) {
                            if (vertex2.reverseEdges[i].endVertex == vertex1) {
                                vertex2.reverseEdges.splice(i, 1);
                                break;
                            }
                        }
                    },
                    /** 
                     * Delete vertex.
                     *
                     * @param vertex Vertex to remove from the graph
                     */
                    removeVertex: function (vertex) {
                        for (var i = vertex.edges.length - 1; i >= 0; i--) {
                            this.removeEdge(vertex, vertex.edges[i].endVertex);
                        }

                        for (var i = vertex.reverseEdges.length - 1; i >= 0; i--) {
                            this.removeEdge(vertex.reverseEdges[i].endVertex, vertex);
                        }

                        for (var i = this.vertices.length - 1; i >= 0; i--) {
                            if (this.vertices[i] == vertex) {
                                this.vertices.splice(i, 1);
                                break;
                            }
                        }

                        this.vertexCount--;
                    },
                    /**
                     * Plots this graph to a canvas.
                     *
                     * @param canvas A proper canvas instance
                     */
                    plot: function (canvas) {
                        var i = 0;
                        /* Draw edges first */
                        for (i = 0; i < this.vertices.length; i++) {
                            var v = this.vertices[i];
                            if (!v.hidden) {
                                for (var j = 0; j < v.edges.length; j++) {
                                    var e = v.edges[j];
                                    /* Draw edge (if not hidden) */
                                    if (!e.hidden)
                                        e.draw(canvas, v);
                                }
                            }
                        }

                        /* Draw the vertices. */
                        for (i = 0; i < this.vertices.length; i++) {
                            v = this.vertices[i];

                            /* Draw vertex (if not hidden) */
                            if (!v.hidden)
                                v.draw(canvas);
                        }
                    },
                    /**
                     * Graph object constructor.
                     * 
                     * @param label Label of this graph
                     * @param directed true or false
                     */
                    Graph: function (label, directed) {
                        /* Fields. */
                        this.label = label;
                        this.vertices = new Array();
                        this.directed = directed;
                        this.vertexCount = 0;
                        this.verticesdiv = new Array();
                        /* Graph methods. */
                        this.insertVertex = foograph.insertVertex;
                        this.insertVertexdiv = foograph.insertVertexdiv;
                        this.removeVertex = foograph.removeVertex;
                        this.insertEdge = foograph.insertEdge;
                        this.removeEdge = foograph.removeEdge;
                        this.plot = foograph.plot;
                    },
                    /**
                     * Vertex object constructor.
                     * 
                     * @param label Label of this vertex
                     * @param next Reference to the next vertex of this graph
                     * @param firstEdge First edge of a linked list of edges
                     */
                    Vertex: function (label, x, y, style) {
                        this.label = label;
                        this.edges = new Array();
                        this.reverseEdges = new Array();
                        this.x = x;
                        this.y = y;
                        this.dx = 0;
                        this.dy = 0;
                        this.level = -1;
                        this.numberOfParents = 0;
                        this.hidden = false;
                        this.fixed = false;     // Fixed vertices are static (unmovable)

                        if (style != null) {
                            this.style = style;
                        }
                        else { // Default
                            this.style = new foograph.VertexStyle('ellipse', 80, 40, '#ffffff', '#000000', true);
                        }
                    },
                    /**
                     * VertexStyle object type for defining vertex style options.
                     *
                     * @param shape Shape of the vertex ('ellipse' or 'rect')
                     * @param width Width in px
                     * @param height Height in px
                     * @param fillColor The color with which the vertex is drawn (RGB HEX string)
                     * @param borderColor The color with which the border of the vertex is drawn (RGB HEX string)
                     * @param showLabel Show the vertex label or not
                     */
                    VertexStyle: function (shape, width, height, fillColor, borderColor, showLabel) {
                        this.shape = shape;
                        this.width = width;
                        this.height = height;
                        this.fillColor = fillColor;
                        this.borderColor = borderColor;
                        this.showLabel = showLabel;
                    },
                    /**
                     * Edge object constructor.
                     *
                     * @param label Label of this edge
                     * @param next Next edge reference
                     * @param weight Edge weight
                     * @param endVertex Destination Vertex instance
                     */
                    Edge: function (label, weight, endVertex, style) {
                        this.label = label;
                        this.weight = weight;
                        this.endVertex = endVertex;
                        this.style = null;
                        this.hidden = false;

                        // Curving information
                        this.curved = false;
                        this.controlX = -1;   // Control coordinates for Bezier curve drawing
                        this.controlY = -1;
                        this.original = null; // If this is a temporary edge it holds the original edge

                        if (style != null) {
                            this.style = style;
                        }
                        else {  // Set to default
                            this.style = new foograph.EdgeStyle(2, '#000000', true, false);
                        }
                    },
                    /**
                     * EdgeStyle object type for defining vertex style options.
                     *
                     * @param width Edge line width
                     * @param color The color with which the edge is drawn
                     * @param showArrow Draw the edge arrow (only if directed)
                     * @param showLabel Show the edge label or not
                     */
                    EdgeStyle: function (width, color, showArrow, showLabel) {
                        this.width = width;
                        this.color = color;
                        this.showArrow = showArrow;
                        this.showLabel = showLabel;
                    },
                    /**
                     * This file is part of foograph Javascript graph library.
                     *
                     * Description: Random vertex layout manager
                     */

                    /**
                     * Class constructor.
                     *
                     * @param width Layout width
                     * @param height Layout height
                     */
                    RandomVertexLayout: function (width, height) {
                        this.width = width;
                        this.height = height;
                    },
                    /**
                     * This file is part of foograph Javascript graph library.
                     *
                     * Description: Fruchterman-Reingold force-directed vertex
                     *              layout manager
                     */

                    /**
                     * Class constructor.
                     *
                     * @param width Layout width
                     * @param height Layout height
                     * @param iterations Number of iterations -
                     * with more iterations it is more likely the layout has converged into a static equilibrium.
                     */
                    ForceDirectedVertexLayout: function (width, height, iterations, randomize, eps) {
                        this.width = width;
                        this.height = height;
                        this.iterations = iterations;
                        this.randomize = randomize;
                        this.eps = eps;
                        this.callback = function () {
                        };
                    },
                    A: 1.5, // Fine tune attraction

                    R: 0.5  // Fine tune repulsion
                };

                /**
                 * toString overload for easier debugging
                 */
                foograph.Vertex.prototype.toString = function () {
                    return "[v:" + this.label + "] ";
                };

                /**
                 * toString overload for easier debugging
                 */
                foograph.Edge.prototype.toString = function () {
                    return "[e:" + this.endVertex.label + "] ";
                };

                /**
                 * Draw vertex method.
                 *
                 * @param canvas jsGraphics instance
                 */
                foograph.Vertex.prototype.draw = function (canvas) {
                    var x = this.x;
                    var y = this.y;
                    var width = this.style.width;
                    var height = this.style.height;
                    var shape = this.style.shape;

                    canvas.setStroke(2);
                    canvas.setColor(this.style.fillColor);

                    if (shape == 'rect') {
                        canvas.fillRect(x, y, width, height);
                        canvas.setColor(this.style.borderColor);
                        canvas.drawRect(x, y, width, height);
                    }
                    else { // Default to ellipse
                        canvas.fillEllipse(x, y, width, height);
                        canvas.setColor(this.style.borderColor);
                        canvas.drawEllipse(x, y, width, height);
                    }

                    if (this.style.showLabel) {
                        canvas.drawStringRect(this.label, x, y + height / 2 - 7, width, 'center');
                    }
                };

                /**
                 * Fits the graph into the bounding box
                 *
                 * @param width
                 * @param height
                 * @param preserveAspect
                 */
                foograph.Graph.prototype.normalize = function (width, height, preserveAspect) {
                    for (var i8 in this.vertices) {
                        var v = this.vertices[i8];
                        v.oldX = v.x;
                        v.oldY = v.y;
                    }
                    var mnx = width * 0.1;
                    var mxx = width * 0.9;
                    var mny = height * 0.1;
                    var mxy = height * 0.9;
                    if (preserveAspect == null)
                        preserveAspect = true;

                    var minx = Number.MAX_VALUE;
                    var miny = Number.MAX_VALUE;
                    var maxx = Number.MIN_VALUE;
                    var maxy = Number.MIN_VALUE;

                    for (var i7 in this.vertices) {
                        var v = this.vertices[i7];
                        if (v.x < minx)
                            minx = v.x;
                        if (v.y < miny)
                            miny = v.y;
                        if (v.x > maxx)
                            maxx = v.x;
                        if (v.y > maxy)
                            maxy = v.y;
                    }
                    var kx = (mxx - mnx) / (maxx - minx);
                    var ky = (mxy - mny) / (maxy - miny);

                    if (preserveAspect) {
                        kx = Math.min(kx, ky);
                        ky = Math.min(kx, ky);
                    }

                    var newMaxx = Number.MIN_VALUE;
                    var newMaxy = Number.MIN_VALUE;
                    for (var i8 in this.vertices) {
                        var v = this.vertices[i8];
                        v.x = (v.x - minx) * kx;
                        v.y = (v.y - miny) * ky;
                        if (v.x > newMaxx)
                            newMaxx = v.x;
                        if (v.y > newMaxy)
                            newMaxy = v.y;
                    }

                    var dx = (width - newMaxx) / 2.0;
                    var dy = (height - newMaxy) / 2.0;
                    for (var i8 in this.vertices) {
                        var v = this.vertices[i8];
                        v.x += dx;
                        v.y += dy;
                    }
                };

                /**
                 * Draw edge method. Draws edge "v" --> "this".
                 *
                 * @param canvas jsGraphics instance
                 * @param v Start vertex
                 */
                foograph.Edge.prototype.draw = function (canvas, v) {
                    var x1 = Math.round(v.x + v.style.width / 2);
                    var y1 = Math.round(v.y + v.style.height / 2);
                    var x2 = Math.round(this.endVertex.x + this.endVertex.style.width / 2);
                    var y2 = Math.round(this.endVertex.y + this.endVertex.style.height / 2);

                    // Control point (needed only for curved edges)
                    var x3 = this.controlX;
                    var y3 = this.controlY;

                    // Arrow tip and angle
                    var X_TIP, Y_TIP, ANGLE;

                    /* Quadric Bezier curve definition. */
                    function Bx(t) {
                        return (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * x3 + t * t * x2;
                    }
                    function By(t) {
                        return (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * y3 + t * t * y2;
                    }

                    canvas.setStroke(this.style.width);
                    canvas.setColor(this.style.color);

                    if (this.curved) { // Draw a quadric Bezier curve
                        this.curved = false; // Reset
                        var t = 0, dt = 1 / 10;
                        var xs = x1, ys = y1, xn, yn;

                        while (t < 1 - dt) {
                            t += dt;
                            xn = Bx(t);
                            yn = By(t);
                            canvas.drawLine(xs, ys, xn, yn);
                            xs = xn;
                            ys = yn;
                        }

                        // Set the arrow tip coordinates
                        X_TIP = xs;
                        Y_TIP = ys;

                        // Move the tip to (0,0) and calculate the angle 
                        // of the arrow head
                        ANGLE = angularCoord(Bx(1 - 2 * dt) - X_TIP, By(1 - 2 * dt) - Y_TIP);

                    } else {
                        canvas.drawLine(x1, y1, x2, y2);

                        // Set the arrow tip coordinates
                        X_TIP = x2;
                        Y_TIP = y2;

                        // Move the tip to (0,0) and calculate the angle 
                        // of the arrow head
                        ANGLE = angularCoord(x1 - X_TIP, y1 - Y_TIP);
                    }

                    if (this.style.showArrow) {
                        drawArrow(ANGLE, X_TIP, Y_TIP);
                    }

                    // TODO
                    if (this.style.showLabel) {
                    }

                    /** 
                     * Draws an edge arrow. 
                     * @param phi The angle (in radians) of the arrow in polar coordinates. 
                     * @param x X coordinate of the arrow tip.
                     * @param y Y coordinate of the arrow tip.
                     */
                    function drawArrow(phi, x, y)
                    {
                        // Arrow bounding box (in px)
                        var H = 50;
                        var W = 10;

                        // Set cartesian coordinates of the arrow
                        var p11 = 0, p12 = 0;
                        var p21 = H, p22 = W / 2;
                        var p31 = H, p32 = -W / 2;

                        // Convert to polar coordinates
                        var r2 = radialCoord(p21, p22);
                        var r3 = radialCoord(p31, p32);
                        var phi2 = angularCoord(p21, p22);
                        var phi3 = angularCoord(p31, p32);

                        // Rotate the arrow
                        phi2 += phi;
                        phi3 += phi;

                        // Update cartesian coordinates
                        p21 = r2 * Math.cos(phi2);
                        p22 = r2 * Math.sin(phi2);
                        p31 = r3 * Math.cos(phi3);
                        p32 = r3 * Math.sin(phi3);

                        // Translate
                        p11 += x;
                        p12 += y;
                        p21 += x;
                        p22 += y;
                        p31 += x;
                        p32 += y;

                        // Draw
                        canvas.fillPolygon(new Array(p11, p21, p31), new Array(p12, p22, p32));
                    }

                    /** 
                     * Get the angular coordinate.
                     * @param x X coordinate
                     * @param y Y coordinate
                     */
                    function angularCoord(x, y)
                    {
                        var phi = 0.0;

                        if (x > 0 && y >= 0) {
                            phi = Math.atan(y / x);
                        }
                        if (x > 0 && y < 0) {
                            phi = Math.atan(y / x) + 2 * Math.PI;
                        }
                        if (x < 0) {
                            phi = Math.atan(y / x) + Math.PI;
                        }
                        if (x = 0 && y > 0) {
                            phi = Math.PI / 2;
                        }
                        if (x = 0 && y < 0) {
                            phi = 3 * Math.PI / 2;
                        }

                        return phi;
                    }

                    /** 
                     * Get the radian coordiante.
                     * @param x1 
                     * @param y1 
                     * @param x2
                     * @param y2 
                     */
                    function radialCoord(x, y)
                    {
                        return Math.sqrt(x * x + y * y);
                    }
                };

                /**
                 * Calculates the coordinates based on pure chance.
                 *
                 * @param graph A valid graph instance
                 */
                foograph.RandomVertexLayout.prototype.layout = function (graph) {
                    for (var i = 0; i < graph.vertices.length; i++) {
                        var v = graph.vertices[i];
                        v.x = Math.round(Math.random() * this.width);
                        v.y = Math.round(Math.random() * this.height);
                    }
                };

                /**
                 * Identifies connected components of a graph and creates "central"
                 * vertices for each component. If there is more than one component,
                 * all central vertices of individual components are connected to
                 * each other to prevent component drift.
                 *
                 * @param graph A valid graph instance
                 * @return A list of component center vertices or null when there
                 *         is only one component.
                 */
                foograph.ForceDirectedVertexLayout.prototype.__identifyComponents = function (graph) {
                    var componentCenters = new Array();
                    var components = new Array();

                    // Depth first search
                    function dfs(vertex)
                    {
                        var stack = new Array();
                        var component = new Array();
                        var centerVertex = new foograph.Vertex("component_center", -1, -1);
                        centerVertex.hidden = true;
                        componentCenters.push(centerVertex);
                        components.push(component);

                        function visitVertex(v)
                        {
                            component.push(v);
                            v.__dfsVisited = true;

                            for (var i in v.edges) {
                                var e = v.edges[i];
                                if (!e.hidden)
                                    stack.push(e.endVertex);
                            }

                            for (var i in v.reverseEdges) {
                                if (!v.reverseEdges[i].hidden)
                                    stack.push(v.reverseEdges[i].endVertex);
                            }
                        }

                        visitVertex(vertex);
                        while (stack.length > 0) {
                            var u = stack.pop();

                            if (!u.__dfsVisited && !u.hidden) {
                                visitVertex(u);
                            }
                        }
                    }

                    // Clear DFS visited flag
                    for (var i in graph.vertices) {
                        var v = graph.vertices[i];
                        v.__dfsVisited = false;
                    }

                    // Iterate through all vertices starting DFS from each vertex
                    // that hasn't been visited yet.
                    for (var k in graph.vertices) {
                        var v = graph.vertices[k];
                        if (!v.__dfsVisited && !v.hidden)
                            dfs(v);
                    }

                    // Interconnect all center vertices
                    if (componentCenters.length > 1) {
                        for (var i in componentCenters) {
                            graph.insertVertex(componentCenters[i]);
                        }
                        for (var i in components) {
                            for (var j in components[i]) {
                                // Connect visited vertex to "central" component vertex
                                edge = graph.insertEdge("", 1, components[i][j], componentCenters[i]);
                                edge.hidden = true;
                            }
                        }

                        for (var i in componentCenters) {
                            for (var j in componentCenters) {
                                if (i != j) {
                                    e = graph.insertEdge("", 3, componentCenters[i], componentCenters[j]);
                                    e.hidden = true;
                                }
                            }
                        }

                        return componentCenters;
                    }

                    return null;
                };

                /**
                 * Calculates the coordinates based on force-directed placement
                 * algorithm.
                 *
                 * @param graph A valid graph instance
                 */
                foograph.ForceDirectedVertexLayout.prototype.layout = function (graph) {


                    this.graph = graph;
                    var area = this.width * this.height;
                    var k = Math.sqrt(area / 45);

                    var t = this.width / 10; // Temperature.
                    var dt = t / (this.iterations + 1);

                    var eps = this.eps; // Minimum distance between the vertices

                    // Attractive and repulsive forces
                    function Fa(z) {
                        return foograph.A * z * z / k;
                    }
                    function Fr(z) {
                        return foograph.R * k * k / z;
                    }
                    function Fw(z) {
                        return 1 / z * z;
                    }  // Force emited by the walls

                    // Initiate component identification and virtual vertex creation
                    // to prevent disconnected graph components from drifting too far apart
                    centers = this.__identifyComponents(graph);


                    // Assign initial random positions
                    if (this.randomize) {
                        randomLayout = new foograph.RandomVertexLayout(this.width, this.height);
                        randomLayout.layout(graph);
                    }



                    // Run through some iterations
                    for (var q = 0; q < this.iterations; q++) {

                        /* Calculate repulsive forces. */
                        for (var i1 in graph.verticesdiv) {
                            var v = graph.vertices[i1];
                            v.dx = 0;
                            v.dy = 0;

                            // Do not move fixed vertices
                            if (!v.fixed) {
                                for (var i2 in graph.vertices) {
                                    var u = graph.vertices[i2];
                                    if (v != u && !u.fixed) {
                                        /* Difference vector between the two vertices. */
                                        var difx = v.x - u.x;
                                        var dify = v.y - u.y;

                                        /* Length of the dif vector. */
                                        var d = Math.max(eps, Math.sqrt(difx * difx + dify * dify));
                                        var force = Fr(d);
                                        v.dx = v.dx + (difx / d) * force;
                                        v.dy = v.dy + (dify / d) * force;

                                    }


                                }
                            }

                        }
                        for (var i3 in graph.verticesdiv) {
                            var v = graph.vertices[i3];
                            if (!v.fixed) {
                                for (var i4 in v.edges) {
                                    var e = v.edges[i4];
                                    var u = e.endVertex;
                                    var difx = v.x - u.x;
                                    var dify = v.y - u.y;
                                    var d = Math.max(eps, Math.sqrt(difx * difx + dify * dify));
                                    var force = Fa(d);
                                    var d = Math.max(eps, Math.sqrt(difx * difx + dify * dify));
                                    v.dx = v.dx - (difx / d) * force;
                                    v.dy = v.dy - (dify / d) * force;

                                    u.dx = u.dx + (difx / d) * force;
                                    u.dy = u.dy + (dify / d) * force;
                                }
                            }
                        }
                        for (var i5 in graph.verticesdiv) {
                            var v = graph.vertices[i5];
                            if (!v.fixed) {
                                var d = Math.max(eps, Math.sqrt(v.dx * v.dx + v.dy * v.dy));
                                v.x = v.x + (v.dx / d) * Math.min(d, t);
                                v.y = v.y + (v.dy / d) * Math.min(d, t);
                                v.x = Math.round(v.x);
                                v.y = Math.round(v.y);


                            }
                        }


                        t -= dt;
                        if (q % 10 == 0) {
                            this.callback();
                        }
                    }


                    if (centers) {
                        for (var i in centers) {
                            graph.removeVertex(centers[i]);
                        }
                    }

                    graph.normalize(this.width, this.height, true);




                };
//IMPLEMENTATION
                var lWidth = pData['width'];
                var lHeight = pData['height'];
                var lMinDist = pData['minDist'];
                var lExpFact = pData['expFact'];
                var lMaxExpIt = pData['maxExpIt'];
                var numworker = pData['numworker'];
                /*
                 * FIRST STEP: Application of the Fruchterman-Reingold algorithm
                 *
                 * We use the version implemented by the foograph library
                 *  
                 * Ref.: https://code.google.com/p/foograph/
                 */

                // We need to create an instance of a graph compatible with the library
                var frg = new foograph.Graph("FRgraph", false);

                var frgNodes = {};

                // Then we have to add the vertices
                var dataVertices = pData['vertices'];
                for (var ni = 0; ni < dataVertices.length; ++ni) {
                    var id = dataVertices[ni]['id'];
                    var v = new foograph.Vertex(id, Math.round(Math.random() * lHeight), Math.round(Math.random() * lHeight));
                    frgNodes[id] = v;
                    frg.insertVertex(v);
                }

                var dataEdges = pData['edges'];
                for (var ei = 0; ei < dataEdges.length; ++ei) {
                    var srcNodeId = dataEdges[ei]['src'];
                    var tgtNodeId = dataEdges[ei]['tgt'];
                    frg.insertEdge("", 1, frgNodes[srcNodeId], frgNodes[tgtNodeId]);
                }

                var frgNodes = {};
                var dataVertices = pData['verticesdiv'][0];
                for (var ni = 0; ni < dataVertices.length; ++ni) {
                    var id = dataVertices[ni]['id'];
                    var v = new foograph.Vertex(id, Math.round(Math.random() * lHeight), Math.round(Math.random() * lHeight));
                    frgNodes[id] = v;
                    frg.insertVertexdiv(v);
                }
                var fv = frg.vertices;
                var frLayoutManager = new foograph.ForceDirectedVertexLayout(lWidth, lHeight, 400, false, 20);
                frLayoutManager.layout(frg);
                var rfv = [];
                    var inarray=[];
                dataVertices.forEach(function(node){
                        inarray.push(node.id);
                    });
                for (var i = 0; i < fv.length; ++i) {
                       inarray.forEach(
                            function(idnode){
                                if(idnode==fv[i].label)
                                { 
                                    
                                     rfv.push(fv[i]);
                                 }
                        });   
                            
                }
        broadcast(rfv);        
});
t1.on('message', function( e ){
           
               fv   =  fv.concat(e.message);
              if (fv.length== nodes.length){  
            
        
                
                var lWidth = pData['width'];
                var lHeight = pData['height'];
                var lMinDist = pData['minDist'];
                var lExpFact = pData['expFact'];
                var lMaxExpIt = pData['maxExpIt'];
                var numworker = pData['numworker'];
               // We calculate the Voronoi diagram dor the position of the nodes
                var voronoi = new Voronoi();
                var bbox = {xl: 0, xr: lWidth, yt: 0, yb: lHeight};
                var vSites = [];
                for (var i = 0; i < fv.length; ++i) {
                    vSites[fv[i].label] = fv[i];
                }

                function checkMinDist(ee) {
                    var infractions = 0;
                    // Then we check if the minimum distance is satisfied
                    for (var eei = 0; eei < ee.length; ++eei) {
                        var e = ee[eei];
                        if ((e.lSite != null) && (e.rSite != null) && sitesDistance(e.lSite, e.rSite) < lMinDist) {
                            ++infractions;
                        }
                    }
                    return infractions;
                }

                var diagram = voronoi.compute(fv, bbox);

                // Then we reposition the nodes at the centroid of their Voronoi cells
                var cells = diagram.cells;
                for (var i = 0; i < cells.length; ++i) {
                    var cell = cells[i];
                    var site = cell.site;
                    var centroid = cellCentroid(cell);
                    var currv = vSites[site.label];
                    currv.x = centroid.x;
                    currv.y = centroid.y;
                }

                if (lExpFact < 0.0) {
                    // Calculates the expanding factor
                    lExpFact = Math.max(0.05, Math.min(0.10, lMinDist / Math.sqrt((lWidth * lHeight) / fv.length) * 0.5));
                    //console.info("Expanding factor is " + (options.expandingFactor * 100.0) + "%");
                }

                var prevInfractions = checkMinDist(diagram.edges);
                //console.info("Initial infractions " + prevInfractions);

                var bStop = (prevInfractions <= 0);

                var voronoiIteration = 0;
                var expandIteration = 0;

                var initWidth = lWidth;

                while (!bStop) {
                    ++voronoiIteration;
                    for (var it = 0; it <= 4; ++it) {
                        voronoi.recycle(diagram);
                        diagram = voronoi.compute(fv, bbox);

                        // Then we reposition the nodes at the centroid of their Voronoi cells
                        cells = diagram.cells;
                        for (var i = 0; i < cells.length; ++i) {
                            var cell = cells[i];
                            var site = cell.site;
                            var centroid = cellCentroid(cell);
                            var currv = vSites[site.label];
                            currv.x = centroid.x;
                            currv.y = centroid.y;
                        }
                    }

                    var currInfractions = checkMinDist(diagram.edges);
                    //console.info("Current infractions " + currInfractions);

                    if (currInfractions <= 0) {
                        bStop = true;
                    } else {
                        if (currInfractions >= prevInfractions || voronoiIteration >= 4) {
                            if (expandIteration >= lMaxExpIt) {
                                bStop = true;
                            } else {
                                lWidth += lWidth * lExpFact;
                                lHeight += lHeight * lExpFact;
                                bbox = {xl: 0, xr: lWidth, yt: 0, yb: lHeight};
                                ++expandIteration;
                                voronoiIteration = 0;
                                //console.info("Expanded to ("+width+","+height+")");
                            }
                        }
                    }
                    prevInfractions = currInfractions;
                }
                // Prepare the data to output
                pData['width'] = lWidth;
                pData['height'] = lHeight;
                pData['expIt'] = expandIteration;
                pData['expFact'] = lExpFact;

                pData['vertices'] = [];
                    
                    
                for (var i = 0; i < fv.length; ++i) {
                       
                    pData['vertices'].push({id: fv[i].label, x: fv[i].x, y: fv[i].y}); 
                }
                
                
                 // First we retrieve the important data
            var expandIteration = pData['expIt'];
            var dataVertices = pData['vertices'];
           var vertices = [];
            for (var i = 0; i < dataVertices.length; ++i) {
                var dv = dataVertices[i];
           vertices[dv.id] = {x: dv.x, y: dv.y};
            } 
            allNodes.positions(
                    function (i, node) {
                        var pos = node._private.position;
                        pos.x = simBB.x1;
                        pos.y = simBB.y1;

                    });

            nodes.positions(
                    function (i, node) {
                        var id = node._private.data.id;
                        var pos = node._private.position;
                        var vertex = vertices[id];
                       
                       
                        pos.x = Math.round(simBB.x1 + vertex.x);
                        pos.y = Math.round(simBB.y1 + vertex.y);
                    });

            if (options.fit && expandIteration > 0) {
                cy.fit(options.padding);
            } else {
                cy.reset();
            }
            cy.nodes().rtrigger("position");
            // Get end time
            var startTime = pData['startTime'];
            var endTime = new Date();
            console.info("Layout on " + dataVertices.length + " nodes took " + (endTime - startTime) + " ms");
            layout.one("layoutstop", options.stop);
            layout.trigger("layoutstop"); 
            }
    t1.stop();
});


//2nd worker

        t2.pass(pData).run(function (pData) {



                /*
                 * FIRST STEP: Application of the Fruchterman-Reingold algorithm
                 *
                 * We use the version implemented by the foograph library
                 *  
                 * Ref.: https://code.google.com/p/foograph/
                 */
                var foograph = {
                    /**
                     * Insert a vertex into this graph.
                     * 
                     * @param vertex A valid Vertex instance
                     */
                    insertVertex: function (vertex) {
                        this.vertices.push(vertex);
                        this.vertexCount++;
                    },
                    insertVertexdiv: function (vertex) {
                        this.verticesdiv.push(vertex);
                        this.vertexCountdiv++;
                    },
                    /**
                     * Insert an edge vertex1 --> vertex2.
                     *  
                     * @param label Label for this edge
                     * @param weight Weight of this edge
                     * @param vertex1 Starting Vertex instance
                     * @param vertex2 Ending Vertex instance
                     * @return Newly created Edge instance
                     */
                    insertEdge: function (label, weight, vertex1, vertex2, style) {
                        var e1 = new foograph.Edge(label, weight, vertex2, style);
                        var e2 = new foograph.Edge(null, weight, vertex1, null);

                        vertex1.edges.push(e1);
                        vertex2.reverseEdges.push(e2);

                        return e1;
                    },
                    /** 
                     * Delete edge.
                     *
                     * @param vertex Starting vertex
                     * @param edge Edge to remove
                     */
                    removeEdge: function (vertex1, vertex2) {
                        for (var i = vertex1.edges.length - 1; i >= 0; i--) {
                            if (vertex1.edges[i].endVertex == vertex2) {
                                vertex1.edges.splice(i, 1);
                                break;
                            }
                        }

                        for (var i = vertex2.reverseEdges.length - 1; i >= 0; i--) {
                            if (vertex2.reverseEdges[i].endVertex == vertex1) {
                                vertex2.reverseEdges.splice(i, 1);
                                break;
                            }
                        }
                    },
                    /** 
                     * Delete vertex.
                     *
                     * @param vertex Vertex to remove from the graph
                     */
                    removeVertex: function (vertex) {
                        for (var i = vertex.edges.length - 1; i >= 0; i--) {
                            this.removeEdge(vertex, vertex.edges[i].endVertex);
                        }

                        for (var i = vertex.reverseEdges.length - 1; i >= 0; i--) {
                            this.removeEdge(vertex.reverseEdges[i].endVertex, vertex);
                        }

                        for (var i = this.vertices.length - 1; i >= 0; i--) {
                            if (this.vertices[i] == vertex) {
                                this.vertices.splice(i, 1);
                                break;
                            }
                        }

                        this.vertexCount--;
                    },
                    /**
                     * Plots this graph to a canvas.
                     *
                     * @param canvas A proper canvas instance
                     */
                    plot: function (canvas) {
                        var i = 0;
                        /* Draw edges first */
                        for (i = 0; i < this.vertices.length; i++) {
                            var v = this.vertices[i];
                            if (!v.hidden) {
                                for (var j = 0; j < v.edges.length; j++) {
                                    var e = v.edges[j];
                                    /* Draw edge (if not hidden) */
                                    if (!e.hidden)
                                        e.draw(canvas, v);
                                }
                            }
                        }

                        /* Draw the vertices. */
                        for (i = 0; i < this.vertices.length; i++) {
                            v = this.vertices[i];

                            /* Draw vertex (if not hidden) */
                            if (!v.hidden)
                                v.draw(canvas);
                        }
                    },
                    /**
                     * Graph object constructor.
                     * 
                     * @param label Label of this graph
                     * @param directed true or false
                     */
                    Graph: function (label, directed) {
                        /* Fields. */
                        this.label = label;
                        this.vertices = new Array();
                        this.directed = directed;
                        this.vertexCount = 0;
                        this.verticesdiv = new Array();
                        /* Graph methods. */
                        this.insertVertex = foograph.insertVertex;
                        this.insertVertexdiv = foograph.insertVertexdiv;
                        this.removeVertex = foograph.removeVertex;
                        this.insertEdge = foograph.insertEdge;
                        this.removeEdge = foograph.removeEdge;
                        this.plot = foograph.plot;
                    },
                    /**
                     * Vertex object constructor.
                     * 
                     * @param label Label of this vertex
                     * @param next Reference to the next vertex of this graph
                     * @param firstEdge First edge of a linked list of edges
                     */
                    Vertex: function (label, x, y, style) {
                        this.label = label;
                        this.edges = new Array();
                        this.reverseEdges = new Array();
                        this.x = x;
                        this.y = y;
                        this.dx = 0;
                        this.dy = 0;
                        this.level = -1;
                        this.numberOfParents = 0;
                        this.hidden = false;
                        this.fixed = false;     // Fixed vertices are static (unmovable)

                        if (style != null) {
                            this.style = style;
                        }
                        else { // Default
                            this.style = new foograph.VertexStyle('ellipse', 80, 40, '#ffffff', '#000000', true);
                        }
                    },
                    /**
                     * VertexStyle object type for defining vertex style options.
                     *
                     * @param shape Shape of the vertex ('ellipse' or 'rect')
                     * @param width Width in px
                     * @param height Height in px
                     * @param fillColor The color with which the vertex is drawn (RGB HEX string)
                     * @param borderColor The color with which the border of the vertex is drawn (RGB HEX string)
                     * @param showLabel Show the vertex label or not
                     */
                    VertexStyle: function (shape, width, height, fillColor, borderColor, showLabel) {
                        this.shape = shape;
                        this.width = width;
                        this.height = height;
                        this.fillColor = fillColor;
                        this.borderColor = borderColor;
                        this.showLabel = showLabel;
                    },
                    /**
                     * Edge object constructor.
                     *
                     * @param label Label of this edge
                     * @param next Next edge reference
                     * @param weight Edge weight
                     * @param endVertex Destination Vertex instance
                     */
                    Edge: function (label, weight, endVertex, style) {
                        this.label = label;
                        this.weight = weight;
                        this.endVertex = endVertex;
                        this.style = null;
                        this.hidden = false;

                        // Curving information
                        this.curved = false;
                        this.controlX = -1;   // Control coordinates for Bezier curve drawing
                        this.controlY = -1;
                        this.original = null; // If this is a temporary edge it holds the original edge

                        if (style != null) {
                            this.style = style;
                        }
                        else {  // Set to default
                            this.style = new foograph.EdgeStyle(2, '#000000', true, false);
                        }
                    },
                    /**
                     * EdgeStyle object type for defining vertex style options.
                     *
                     * @param width Edge line width
                     * @param color The color with which the edge is drawn
                     * @param showArrow Draw the edge arrow (only if directed)
                     * @param showLabel Show the edge label or not
                     */
                    EdgeStyle: function (width, color, showArrow, showLabel) {
                        this.width = width;
                        this.color = color;
                        this.showArrow = showArrow;
                        this.showLabel = showLabel;
                    },
                    /**
                     * This file is part of foograph Javascript graph library.
                     *
                     * Description: Random vertex layout manager
                     */

                    /**
                     * Class constructor.
                     *
                     * @param width Layout width
                     * @param height Layout height
                     */
                    RandomVertexLayout: function (width, height) {
                        this.width = width;
                        this.height = height;
                    },
                    /**
                     * This file is part of foograph Javascript graph library.
                     *
                     * Description: Fruchterman-Reingold force-directed vertex
                     *              layout manager
                     */

                    /**
                     * Class constructor.
                     *
                     * @param width Layout width
                     * @param height Layout height
                     * @param iterations Number of iterations -
                     * with more iterations it is more likely the layout has converged into a static equilibrium.
                     */
                    ForceDirectedVertexLayout: function (width, height, iterations, randomize, eps) {
                        this.width = width;
                        this.height = height;
                        this.iterations = iterations;
                        this.randomize = randomize;
                        this.eps = eps;
                        this.callback = function () {
                        };
                    },
                    A: 1.5, // Fine tune attraction

                    R: 0.5  // Fine tune repulsion
                };

                /**
                 * toString overload for easier debugging
                 */
                foograph.Vertex.prototype.toString = function () {
                    return "[v:" + this.label + "] ";
                };

                /**
                 * toString overload for easier debugging
                 */
                foograph.Edge.prototype.toString = function () {
                    return "[e:" + this.endVertex.label + "] ";
                };

                /**
                 * Draw vertex method.
                 *
                 * @param canvas jsGraphics instance
                 */
                foograph.Vertex.prototype.draw = function (canvas) {
                    var x = this.x;
                    var y = this.y;
                    var width = this.style.width;
                    var height = this.style.height;
                    var shape = this.style.shape;

                    canvas.setStroke(2);
                    canvas.setColor(this.style.fillColor);

                    if (shape == 'rect') {
                        canvas.fillRect(x, y, width, height);
                        canvas.setColor(this.style.borderColor);
                        canvas.drawRect(x, y, width, height);
                    }
                    else { // Default to ellipse
                        canvas.fillEllipse(x, y, width, height);
                        canvas.setColor(this.style.borderColor);
                        canvas.drawEllipse(x, y, width, height);
                    }

                    if (this.style.showLabel) {
                        canvas.drawStringRect(this.label, x, y + height / 2 - 7, width, 'center');
                    }
                };

                /**
                 * Fits the graph into the bounding box
                 *
                 * @param width
                 * @param height
                 * @param preserveAspect
                 */
                foograph.Graph.prototype.normalize = function (width, height, preserveAspect) {
                    for (var i8 in this.vertices) {
                        var v = this.vertices[i8];
                        v.oldX = v.x;
                        v.oldY = v.y;
                    }
                    var mnx = width * 0.1;
                    var mxx = width * 0.9;
                    var mny = height * 0.1;
                    var mxy = height * 0.9;
                    if (preserveAspect == null)
                        preserveAspect = true;

                    var minx = Number.MAX_VALUE;
                    var miny = Number.MAX_VALUE;
                    var maxx = Number.MIN_VALUE;
                    var maxy = Number.MIN_VALUE;

                    for (var i7 in this.vertices) {
                        var v = this.vertices[i7];
                        if (v.x < minx)
                            minx = v.x;
                        if (v.y < miny)
                            miny = v.y;
                        if (v.x > maxx)
                            maxx = v.x;
                        if (v.y > maxy)
                            maxy = v.y;
                    }
                    var kx = (mxx - mnx) / (maxx - minx);
                    var ky = (mxy - mny) / (maxy - miny);

                    if (preserveAspect) {
                        kx = Math.min(kx, ky);
                        ky = Math.min(kx, ky);
                    }

                    var newMaxx = Number.MIN_VALUE;
                    var newMaxy = Number.MIN_VALUE;
                    for (var i8 in this.vertices) {
                        var v = this.vertices[i8];
                        v.x = (v.x - minx) * kx;
                        v.y = (v.y - miny) * ky;
                        if (v.x > newMaxx)
                            newMaxx = v.x;
                        if (v.y > newMaxy)
                            newMaxy = v.y;
                    }

                    var dx = (width - newMaxx) / 2.0;
                    var dy = (height - newMaxy) / 2.0;
                    for (var i8 in this.vertices) {
                        var v = this.vertices[i8];
                        v.x += dx;
                        v.y += dy;
                    }
                };

                /**
                 * Draw edge method. Draws edge "v" --> "this".
                 *
                 * @param canvas jsGraphics instance
                 * @param v Start vertex
                 */
                foograph.Edge.prototype.draw = function (canvas, v) {
                    var x1 = Math.round(v.x + v.style.width / 2);
                    var y1 = Math.round(v.y + v.style.height / 2);
                    var x2 = Math.round(this.endVertex.x + this.endVertex.style.width / 2);
                    var y2 = Math.round(this.endVertex.y + this.endVertex.style.height / 2);

                    // Control point (needed only for curved edges)
                    var x3 = this.controlX;
                    var y3 = this.controlY;

                    // Arrow tip and angle
                    var X_TIP, Y_TIP, ANGLE;

                    /* Quadric Bezier curve definition. */
                    function Bx(t) {
                        return (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * x3 + t * t * x2;
                    }
                    function By(t) {
                        return (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * y3 + t * t * y2;
                    }

                    canvas.setStroke(this.style.width);
                    canvas.setColor(this.style.color);

                    if (this.curved) { // Draw a quadric Bezier curve
                        this.curved = false; // Reset
                        var t = 0, dt = 1 / 10;
                        var xs = x1, ys = y1, xn, yn;

                        while (t < 1 - dt) {
                            t += dt;
                            xn = Bx(t);
                            yn = By(t);
                            canvas.drawLine(xs, ys, xn, yn);
                            xs = xn;
                            ys = yn;
                        }

                        // Set the arrow tip coordinates
                        X_TIP = xs;
                        Y_TIP = ys;

                        // Move the tip to (0,0) and calculate the angle 
                        // of the arrow head
                        ANGLE = angularCoord(Bx(1 - 2 * dt) - X_TIP, By(1 - 2 * dt) - Y_TIP);

                    } else {
                        canvas.drawLine(x1, y1, x2, y2);

                        // Set the arrow tip coordinates
                        X_TIP = x2;
                        Y_TIP = y2;

                        // Move the tip to (0,0) and calculate the angle 
                        // of the arrow head
                        ANGLE = angularCoord(x1 - X_TIP, y1 - Y_TIP);
                    }

                    if (this.style.showArrow) {
                        drawArrow(ANGLE, X_TIP, Y_TIP);
                    }

                    // TODO
                    if (this.style.showLabel) {
                    }

                    /** 
                     * Draws an edge arrow. 
                     * @param phi The angle (in radians) of the arrow in polar coordinates. 
                     * @param x X coordinate of the arrow tip.
                     * @param y Y coordinate of the arrow tip.
                     */
                    function drawArrow(phi, x, y)
                    {
                        // Arrow bounding box (in px)
                        var H = 50;
                        var W = 10;

                        // Set cartesian coordinates of the arrow
                        var p11 = 0, p12 = 0;
                        var p21 = H, p22 = W / 2;
                        var p31 = H, p32 = -W / 2;

                        // Convert to polar coordinates
                        var r2 = radialCoord(p21, p22);
                        var r3 = radialCoord(p31, p32);
                        var phi2 = angularCoord(p21, p22);
                        var phi3 = angularCoord(p31, p32);

                        // Rotate the arrow
                        phi2 += phi;
                        phi3 += phi;

                        // Update cartesian coordinates
                        p21 = r2 * Math.cos(phi2);
                        p22 = r2 * Math.sin(phi2);
                        p31 = r3 * Math.cos(phi3);
                        p32 = r3 * Math.sin(phi3);

                        // Translate
                        p11 += x;
                        p12 += y;
                        p21 += x;
                        p22 += y;
                        p31 += x;
                        p32 += y;

                        // Draw
                        canvas.fillPolygon(new Array(p11, p21, p31), new Array(p12, p22, p32));
                    }

                    /** 
                     * Get the angular coordinate.
                     * @param x X coordinate
                     * @param y Y coordinate
                     */
                    function angularCoord(x, y)
                    {
                        var phi = 0.0;

                        if (x > 0 && y >= 0) {
                            phi = Math.atan(y / x);
                        }
                        if (x > 0 && y < 0) {
                            phi = Math.atan(y / x) + 2 * Math.PI;
                        }
                        if (x < 0) {
                            phi = Math.atan(y / x) + Math.PI;
                        }
                        if (x = 0 && y > 0) {
                            phi = Math.PI / 2;
                        }
                        if (x = 0 && y < 0) {
                            phi = 3 * Math.PI / 2;
                        }

                        return phi;
                    }

                    /** 
                     * Get the radian coordiante.
                     * @param x1 
                     * @param y1 
                     * @param x2
                     * @param y2 
                     */
                    function radialCoord(x, y)
                    {
                        return Math.sqrt(x * x + y * y);
                    }
                };

                /**
                 * Calculates the coordinates based on pure chance.
                 *
                 * @param graph A valid graph instance
                 */
                foograph.RandomVertexLayout.prototype.layout = function (graph) {
                    for (var i = 0; i < graph.vertices.length; i++) {
                        var v = graph.vertices[i];
                        v.x = Math.round(Math.random() * this.width);
                        v.y = Math.round(Math.random() * this.height);
                    }
                };

                /**
                 * Identifies connected components of a graph and creates "central"
                 * vertices for each component. If there is more than one component,
                 * all central vertices of individual components are connected to
                 * each other to prevent component drift.
                 *
                 * @param graph A valid graph instance
                 * @return A list of component center vertices or null when there
                 *         is only one component.
                 */
                foograph.ForceDirectedVertexLayout.prototype.__identifyComponents = function (graph) {
                    var componentCenters = new Array();
                    var components = new Array();

                    // Depth first search
                    function dfs(vertex)
                    {
                        var stack = new Array();
                        var component = new Array();
                        var centerVertex = new foograph.Vertex("component_center", -1, -1);
                        centerVertex.hidden = true;
                        componentCenters.push(centerVertex);
                        components.push(component);

                        function visitVertex(v)
                        {
                            component.push(v);
                            v.__dfsVisited = true;

                            for (var i in v.edges) {
                                var e = v.edges[i];
                                if (!e.hidden)
                                    stack.push(e.endVertex);
                            }

                            for (var i in v.reverseEdges) {
                                if (!v.reverseEdges[i].hidden)
                                    stack.push(v.reverseEdges[i].endVertex);
                            }
                        }

                        visitVertex(vertex);
                        while (stack.length > 0) {
                            var u = stack.pop();

                            if (!u.__dfsVisited && !u.hidden) {
                                visitVertex(u);
                            }
                        }
                    }

                    // Clear DFS visited flag
                    for (var i in graph.vertices) {
                        var v = graph.vertices[i];
                        v.__dfsVisited = false;
                    }

                    // Iterate through all vertices starting DFS from each vertex
                    // that hasn't been visited yet.
                    for (var k in graph.vertices) {
                        var v = graph.vertices[k];
                        if (!v.__dfsVisited && !v.hidden)
                            dfs(v);
                    }

                    // Interconnect all center vertices
                    if (componentCenters.length > 1) {
                        for (var i in componentCenters) {
                            graph.insertVertex(componentCenters[i]);
                        }
                        for (var i in components) {
                            for (var j in components[i]) {
                                // Connect visited vertex to "central" component vertex
                                edge = graph.insertEdge("", 1, components[i][j], componentCenters[i]);
                                edge.hidden = true;
                            }
                        }

                        for (var i in componentCenters) {
                            for (var j in componentCenters) {
                                if (i != j) {
                                    e = graph.insertEdge("", 3, componentCenters[i], componentCenters[j]);
                                    e.hidden = true;
                                }
                            }
                        }

                        return componentCenters;
                    }

                    return null;
                };

                /**
                 * Calculates the coordinates based on force-directed placement
                 * algorithm.
                 *
                 * @param graph A valid graph instance
                 */
                foograph.ForceDirectedVertexLayout.prototype.layout = function (graph) {


                    this.graph = graph;
                    var area = this.width * this.height;
                    var k = Math.sqrt(area / 45);

                    var t = this.width / 10; // Temperature.
                    var dt = t / (this.iterations + 1);

                    var eps = this.eps; // Minimum distance between the vertices

                    // Attractive and repulsive forces
                    function Fa(z) {
                        return foograph.A * z * z / k;
                    }
                    function Fr(z) {
                        return foograph.R * k * k / z;
                    }
                    function Fw(z) {
                        return 1 / z * z;
                    }  // Force emited by the walls

                    // Initiate component identification and virtual vertex creation
                    // to prevent disconnected graph components from drifting too far apart
                    centers = this.__identifyComponents(graph);


                    // Assign initial random positions
                    if (this.randomize) {
                        randomLayout = new foograph.RandomVertexLayout(this.width, this.height);
                        randomLayout.layout(graph);
                    }



                    // Run through some iterations
                    for (var q = 0; q < this.iterations; q++) {

                        /* Calculate repulsive forces. */
                        for (var i1 in graph.verticesdiv) {
                            var v = graph.vertices[i1];
                            v.dx = 0;
                            v.dy = 0;

                            // Do not move fixed vertices
                            if (!v.fixed) {
                                for (var i2 in graph.vertices) {
                                    var u = graph.vertices[i2];
                                    if (v != u && !u.fixed) {
                                        /* Difference vector between the two vertices. */
                                        var difx = v.x - u.x;
                                        var dify = v.y - u.y;

                                        /* Length of the dif vector. */
                                        var d = Math.max(eps, Math.sqrt(difx * difx + dify * dify));
                                        var force = Fr(d);
                                        v.dx = v.dx + (difx / d) * force;
                                        v.dy = v.dy + (dify / d) * force;

                                    }


                                }
                            }

                        }
                        for (var i3 in graph.verticesdiv) {
                            var v = graph.vertices[i3];
                            if (!v.fixed) {
                                for (var i4 in v.edges) {
                                    var e = v.edges[i4];
                                    var u = e.endVertex;
                                    var difx = v.x - u.x;
                                    var dify = v.y - u.y;
                                    var d = Math.max(eps, Math.sqrt(difx * difx + dify * dify));
                                    var force = Fa(d);
                                    var d = Math.max(eps, Math.sqrt(difx * difx + dify * dify));
                                    v.dx = v.dx - (difx / d) * force;
                                    v.dy = v.dy - (dify / d) * force;

                                    u.dx = u.dx + (difx / d) * force;
                                    u.dy = u.dy + (dify / d) * force;
                                }
                            }
                        }
                        for (var i5 in graph.verticesdiv) {
                            var v = graph.vertices[i5];
                            if (!v.fixed) {
                                var d = Math.max(eps, Math.sqrt(v.dx * v.dx + v.dy * v.dy));
                                v.x = v.x + (v.dx / d) * Math.min(d, t);
                                v.y = v.y + (v.dy / d) * Math.min(d, t);
                                v.x = Math.round(v.x);
                                v.y = Math.round(v.y);


                            }
                        }


                        t -= dt;
                        if (q % 10 == 0) {
                            this.callback();
                        }
                    }


                    if (centers) {
                        for (var i in centers) {
                            graph.removeVertex(centers[i]);
                        }
                    }

                    graph.normalize(this.width, this.height, true);




                };
//IMPLEMENTATION
                var lWidth = pData['width'];
                var lHeight = pData['height'];
                var lMinDist = pData['minDist'];
                var lExpFact = pData['expFact'];
                var lMaxExpIt = pData['maxExpIt'];
                var numworker = pData['numworker'];
                /*
                 * FIRST STEP: Application of the Fruchterman-Reingold algorithm
                 *
                 * We use the version implemented by the foograph library
                 *  
                 * Ref.: https://code.google.com/p/foograph/
                 */

                // We need to create an instance of a graph compatible with the library
                var frg = new foograph.Graph("FRgraph", false);

                var frgNodes = {};

                // Then we have to add the vertices
                var dataVertices = pData['vertices'];
                for (var ni = 0; ni < dataVertices.length; ++ni) {
                    var id = dataVertices[ni]['id'];
                    var v = new foograph.Vertex(id, Math.round(Math.random() * lHeight), Math.round(Math.random() * lHeight));
                    frgNodes[id] = v;
                    frg.insertVertex(v);
                }

                var dataEdges = pData['edges'];
                for (var ei = 0; ei < dataEdges.length; ++ei) {
                    var srcNodeId = dataEdges[ei]['src'];
                    var tgtNodeId = dataEdges[ei]['tgt'];
                    frg.insertEdge("", 1, frgNodes[srcNodeId], frgNodes[tgtNodeId]);
                }

                var frgNodes = {};
                var dataVertices = pData['verticesdiv'][1];
                for (var ni = 0; ni < dataVertices.length; ++ni) {
                    var id = dataVertices[ni]['id'];
                    var v = new foograph.Vertex(id, Math.round(Math.random() * lHeight), Math.round(Math.random() * lHeight));
                    frgNodes[id] = v;
                    frg.insertVertexdiv(v);
                }
                var fv = frg.vertices;
                var frLayoutManager = new foograph.ForceDirectedVertexLayout(lWidth, lHeight, 400, false, 20);
                frLayoutManager.layout(frg);
                var rfv = [];
                    var inarray=[];
                dataVertices.forEach(function(node){
                        inarray.push(node.id);
                    });
                for (var i = 0; i < fv.length; ++i) {
                       inarray.forEach(
                            function(idnode){
                                if(idnode==fv[i].label)
                                { 
                                    
                                     rfv.push(fv[i]);
                                 }
                        });   
                            
                }
        broadcast(rfv);        
});
t2.on('message', function( e ){
          
              fv   =  fv.concat(e.message);
              if (fv.length== nodes.length){         
                var lWidth = pData['width'];
                var lHeight = pData['height'];
                var lMinDist = pData['minDist'];
                var lExpFact = pData['expFact'];
                var lMaxExpIt = pData['maxExpIt'];
                var numworker = pData['numworker'];
               // We calculate the Voronoi diagram dor the position of the nodes
                var voronoi = new Voronoi();
                var bbox = {xl: 0, xr: lWidth, yt: 0, yb: lHeight};
                var vSites = [];
                for (var i = 0; i < fv.length; ++i) {
                    vSites[fv[i].label] = fv[i];
                }

                function checkMinDist(ee) {
                    var infractions = 0;
                    // Then we check if the minimum distance is satisfied
                    for (var eei = 0; eei < ee.length; ++eei) {
                        var e = ee[eei];
                        if ((e.lSite != null) && (e.rSite != null) && sitesDistance(e.lSite, e.rSite) < lMinDist) {
                            ++infractions;
                        }
                    }
                    return infractions;
                }

                var diagram = voronoi.compute(fv, bbox);

                // Then we reposition the nodes at the centroid of their Voronoi cells
                var cells = diagram.cells;
                for (var i = 0; i < cells.length; ++i) {
                    var cell = cells[i];
                    var site = cell.site;
                    var centroid = cellCentroid(cell);
                    var currv = vSites[site.label];
                    currv.x = centroid.x;
                    currv.y = centroid.y;
                }

                if (lExpFact < 0.0) {
                    // Calculates the expanding factor
                    lExpFact = Math.max(0.05, Math.min(0.10, lMinDist / Math.sqrt((lWidth * lHeight) / fv.length) * 0.5));
                    //console.info("Expanding factor is " + (options.expandingFactor * 100.0) + "%");
                }

                var prevInfractions = checkMinDist(diagram.edges);
                //console.info("Initial infractions " + prevInfractions);

                var bStop = (prevInfractions <= 0);

                var voronoiIteration = 0;
                var expandIteration = 0;

                var initWidth = lWidth;

                while (!bStop) {
                    ++voronoiIteration;
                    for (var it = 0; it <= 4; ++it) {
                        voronoi.recycle(diagram);
                        diagram = voronoi.compute(fv, bbox);

                        // Then we reposition the nodes at the centroid of their Voronoi cells
                        cells = diagram.cells;
                        for (var i = 0; i < cells.length; ++i) {
                            var cell = cells[i];
                            var site = cell.site;
                            var centroid = cellCentroid(cell);
                            var currv = vSites[site.label];
                            currv.x = centroid.x;
                            currv.y = centroid.y;
                        }
                    }

                    var currInfractions = checkMinDist(diagram.edges);
                    //console.info("Current infractions " + currInfractions);

                    if (currInfractions <= 0) {
                        bStop = true;
                    } else {
                        if (currInfractions >= prevInfractions || voronoiIteration >= 4) {
                            if (expandIteration >= lMaxExpIt) {
                                bStop = true;
                            } else {
                                lWidth += lWidth * lExpFact;
                                lHeight += lHeight * lExpFact;
                                bbox = {xl: 0, xr: lWidth, yt: 0, yb: lHeight};
                                ++expandIteration;
                                voronoiIteration = 0;
                                //console.info("Expanded to ("+width+","+height+")");
                            }
                        }
                    }
                    prevInfractions = currInfractions;
                }
                // Prepare the data to output
                pData['width'] = lWidth;
                pData['height'] = lHeight;
                pData['expIt'] = expandIteration;
                pData['expFact'] = lExpFact;

                pData['vertices'] = [];
                    
                    
                for (var i = 0; i < fv.length; ++i) {
                       
                    pData['vertices'].push({id: fv[i].label, x: fv[i].x, y: fv[i].y}); 
                }
                
                
                 // First we retrieve the important data
            var expandIteration = pData['expIt'];
            var dataVertices = pData['vertices'];
           var vertices = [];
            for (var i = 0; i < dataVertices.length; ++i) {
                var dv = dataVertices[i];
           vertices[dv.id] = {x: dv.x, y: dv.y};
            } 
            allNodes.positions(
                    function (i, node) {
                        var pos = node._private.position;
                        pos.x = simBB.x1;
                        pos.y = simBB.y1;

                    });

            nodes.positions(
                    function (i, node) {
                        var id = node._private.data.id;
                        var pos = node._private.position;
                        var vertex = vertices[id];
                       
                       
                        pos.x = Math.round(simBB.x1 + vertex.x);
                        pos.y = Math.round(simBB.y1 + vertex.y);
                    });

            if (options.fit && expandIteration > 0) {
                cy.fit(options.padding);
            } else {
                cy.reset();
            }
            cy.nodes().rtrigger("position");
            // Get end time
            var startTime = pData['startTime'];
            var endTime = new Date();
            console.info("Layout on " + dataVertices.length + " nodes took " + (endTime - startTime) + " ms");
            layout.one("layoutstop", options.stop);
            layout.trigger("layoutstop"); 
            }
    t2.stop();
});
//3rd worker


        t3.pass(pData).run(function (pData) {



                /*
                 * FIRST STEP: Application of the Fruchterman-Reingold algorithm
                 *
                 * We use the version implemented by the foograph library
                 *  
                 * Ref.: https://code.google.com/p/foograph/
                 */
                var foograph = {
                    /**
                     * Insert a vertex into this graph.
                     * 
                     * @param vertex A valid Vertex instance
                     */
                    insertVertex: function (vertex) {
                        this.vertices.push(vertex);
                        this.vertexCount++;
                    },
                    insertVertexdiv: function (vertex) {
                        this.verticesdiv.push(vertex);
                        this.vertexCountdiv++;
                    },
                    /**
                     * Insert an edge vertex1 --> vertex2.
                     *  
                     * @param label Label for this edge
                     * @param weight Weight of this edge
                     * @param vertex1 Starting Vertex instance
                     * @param vertex2 Ending Vertex instance
                     * @return Newly created Edge instance
                     */
                    insertEdge: function (label, weight, vertex1, vertex2, style) {
                        var e1 = new foograph.Edge(label, weight, vertex2, style);
                        var e2 = new foograph.Edge(null, weight, vertex1, null);

                        vertex1.edges.push(e1);
                        vertex2.reverseEdges.push(e2);

                        return e1;
                    },
                    /** 
                     * Delete edge.
                     *
                     * @param vertex Starting vertex
                     * @param edge Edge to remove
                     */
                    removeEdge: function (vertex1, vertex2) {
                        for (var i = vertex1.edges.length - 1; i >= 0; i--) {
                            if (vertex1.edges[i].endVertex == vertex2) {
                                vertex1.edges.splice(i, 1);
                                break;
                            }
                        }

                        for (var i = vertex2.reverseEdges.length - 1; i >= 0; i--) {
                            if (vertex2.reverseEdges[i].endVertex == vertex1) {
                                vertex2.reverseEdges.splice(i, 1);
                                break;
                            }
                        }
                    },
                    /** 
                     * Delete vertex.
                     *
                     * @param vertex Vertex to remove from the graph
                     */
                    removeVertex: function (vertex) {
                        for (var i = vertex.edges.length - 1; i >= 0; i--) {
                            this.removeEdge(vertex, vertex.edges[i].endVertex);
                        }

                        for (var i = vertex.reverseEdges.length - 1; i >= 0; i--) {
                            this.removeEdge(vertex.reverseEdges[i].endVertex, vertex);
                        }

                        for (var i = this.vertices.length - 1; i >= 0; i--) {
                            if (this.vertices[i] == vertex) {
                                this.vertices.splice(i, 1);
                                break;
                            }
                        }

                        this.vertexCount--;
                    },
                    /**
                     * Plots this graph to a canvas.
                     *
                     * @param canvas A proper canvas instance
                     */
                    plot: function (canvas) {
                        var i = 0;
                        /* Draw edges first */
                        for (i = 0; i < this.vertices.length; i++) {
                            var v = this.vertices[i];
                            if (!v.hidden) {
                                for (var j = 0; j < v.edges.length; j++) {
                                    var e = v.edges[j];
                                    /* Draw edge (if not hidden) */
                                    if (!e.hidden)
                                        e.draw(canvas, v);
                                }
                            }
                        }

                        /* Draw the vertices. */
                        for (i = 0; i < this.vertices.length; i++) {
                            v = this.vertices[i];

                            /* Draw vertex (if not hidden) */
                            if (!v.hidden)
                                v.draw(canvas);
                        }
                    },
                    /**
                     * Graph object constructor.
                     * 
                     * @param label Label of this graph
                     * @param directed true or false
                     */
                    Graph: function (label, directed) {
                        /* Fields. */
                        this.label = label;
                        this.vertices = new Array();
                        this.directed = directed;
                        this.vertexCount = 0;
                        this.verticesdiv = new Array();
                        /* Graph methods. */
                        this.insertVertex = foograph.insertVertex;
                        this.insertVertexdiv = foograph.insertVertexdiv;
                        this.removeVertex = foograph.removeVertex;
                        this.insertEdge = foograph.insertEdge;
                        this.removeEdge = foograph.removeEdge;
                        this.plot = foograph.plot;
                    },
                    /**
                     * Vertex object constructor.
                     * 
                     * @param label Label of this vertex
                     * @param next Reference to the next vertex of this graph
                     * @param firstEdge First edge of a linked list of edges
                     */
                    Vertex: function (label, x, y, style) {
                        this.label = label;
                        this.edges = new Array();
                        this.reverseEdges = new Array();
                        this.x = x;
                        this.y = y;
                        this.dx = 0;
                        this.dy = 0;
                        this.level = -1;
                        this.numberOfParents = 0;
                        this.hidden = false;
                        this.fixed = false;     // Fixed vertices are static (unmovable)

                        if (style != null) {
                            this.style = style;
                        }
                        else { // Default
                            this.style = new foograph.VertexStyle('ellipse', 80, 40, '#ffffff', '#000000', true);
                        }
                    },
                    /**
                     * VertexStyle object type for defining vertex style options.
                     *
                     * @param shape Shape of the vertex ('ellipse' or 'rect')
                     * @param width Width in px
                     * @param height Height in px
                     * @param fillColor The color with which the vertex is drawn (RGB HEX string)
                     * @param borderColor The color with which the border of the vertex is drawn (RGB HEX string)
                     * @param showLabel Show the vertex label or not
                     */
                    VertexStyle: function (shape, width, height, fillColor, borderColor, showLabel) {
                        this.shape = shape;
                        this.width = width;
                        this.height = height;
                        this.fillColor = fillColor;
                        this.borderColor = borderColor;
                        this.showLabel = showLabel;
                    },
                    /**
                     * Edge object constructor.
                     *
                     * @param label Label of this edge
                     * @param next Next edge reference
                     * @param weight Edge weight
                     * @param endVertex Destination Vertex instance
                     */
                    Edge: function (label, weight, endVertex, style) {
                        this.label = label;
                        this.weight = weight;
                        this.endVertex = endVertex;
                        this.style = null;
                        this.hidden = false;

                        // Curving information
                        this.curved = false;
                        this.controlX = -1;   // Control coordinates for Bezier curve drawing
                        this.controlY = -1;
                        this.original = null; // If this is a temporary edge it holds the original edge

                        if (style != null) {
                            this.style = style;
                        }
                        else {  // Set to default
                            this.style = new foograph.EdgeStyle(2, '#000000', true, false);
                        }
                    },
                    /**
                     * EdgeStyle object type for defining vertex style options.
                     *
                     * @param width Edge line width
                     * @param color The color with which the edge is drawn
                     * @param showArrow Draw the edge arrow (only if directed)
                     * @param showLabel Show the edge label or not
                     */
                    EdgeStyle: function (width, color, showArrow, showLabel) {
                        this.width = width;
                        this.color = color;
                        this.showArrow = showArrow;
                        this.showLabel = showLabel;
                    },
                    /**
                     * This file is part of foograph Javascript graph library.
                     *
                     * Description: Random vertex layout manager
                     */

                    /**
                     * Class constructor.
                     *
                     * @param width Layout width
                     * @param height Layout height
                     */
                    RandomVertexLayout: function (width, height) {
                        this.width = width;
                        this.height = height;
                    },
                    /**
                     * This file is part of foograph Javascript graph library.
                     *
                     * Description: Fruchterman-Reingold force-directed vertex
                     *              layout manager
                     */

                    /**
                     * Class constructor.
                     *
                     * @param width Layout width
                     * @param height Layout height
                     * @param iterations Number of iterations -
                     * with more iterations it is more likely the layout has converged into a static equilibrium.
                     */
                    ForceDirectedVertexLayout: function (width, height, iterations, randomize, eps) {
                        this.width = width;
                        this.height = height;
                        this.iterations = iterations;
                        this.randomize = randomize;
                        this.eps = eps;
                        this.callback = function () {
                        };
                    },
                    A: 1.5, // Fine tune attraction

                    R: 0.5  // Fine tune repulsion
                };

                /**
                 * toString overload for easier debugging
                 */
                foograph.Vertex.prototype.toString = function () {
                    return "[v:" + this.label + "] ";
                };

                /**
                 * toString overload for easier debugging
                 */
                foograph.Edge.prototype.toString = function () {
                    return "[e:" + this.endVertex.label + "] ";
                };

                /**
                 * Draw vertex method.
                 *
                 * @param canvas jsGraphics instance
                 */
                foograph.Vertex.prototype.draw = function (canvas) {
                    var x = this.x;
                    var y = this.y;
                    var width = this.style.width;
                    var height = this.style.height;
                    var shape = this.style.shape;

                    canvas.setStroke(2);
                    canvas.setColor(this.style.fillColor);

                    if (shape == 'rect') {
                        canvas.fillRect(x, y, width, height);
                        canvas.setColor(this.style.borderColor);
                        canvas.drawRect(x, y, width, height);
                    }
                    else { // Default to ellipse
                        canvas.fillEllipse(x, y, width, height);
                        canvas.setColor(this.style.borderColor);
                        canvas.drawEllipse(x, y, width, height);
                    }

                    if (this.style.showLabel) {
                        canvas.drawStringRect(this.label, x, y + height / 2 - 7, width, 'center');
                    }
                };

                /**
                 * Fits the graph into the bounding box
                 *
                 * @param width
                 * @param height
                 * @param preserveAspect
                 */
                foograph.Graph.prototype.normalize = function (width, height, preserveAspect) {
                    for (var i8 in this.vertices) {
                        var v = this.vertices[i8];
                        v.oldX = v.x;
                        v.oldY = v.y;
                    }
                    var mnx = width * 0.1;
                    var mxx = width * 0.9;
                    var mny = height * 0.1;
                    var mxy = height * 0.9;
                    if (preserveAspect == null)
                        preserveAspect = true;

                    var minx = Number.MAX_VALUE;
                    var miny = Number.MAX_VALUE;
                    var maxx = Number.MIN_VALUE;
                    var maxy = Number.MIN_VALUE;

                    for (var i7 in this.vertices) {
                        var v = this.vertices[i7];
                        if (v.x < minx)
                            minx = v.x;
                        if (v.y < miny)
                            miny = v.y;
                        if (v.x > maxx)
                            maxx = v.x;
                        if (v.y > maxy)
                            maxy = v.y;
                    }
                    var kx = (mxx - mnx) / (maxx - minx);
                    var ky = (mxy - mny) / (maxy - miny);

                    if (preserveAspect) {
                        kx = Math.min(kx, ky);
                        ky = Math.min(kx, ky);
                    }

                    var newMaxx = Number.MIN_VALUE;
                    var newMaxy = Number.MIN_VALUE;
                    for (var i8 in this.vertices) {
                        var v = this.vertices[i8];
                        v.x = (v.x - minx) * kx;
                        v.y = (v.y - miny) * ky;
                        if (v.x > newMaxx)
                            newMaxx = v.x;
                        if (v.y > newMaxy)
                            newMaxy = v.y;
                    }

                    var dx = (width - newMaxx) / 2.0;
                    var dy = (height - newMaxy) / 2.0;
                    for (var i8 in this.vertices) {
                        var v = this.vertices[i8];
                        v.x += dx;
                        v.y += dy;
                    }
                };

                /**
                 * Draw edge method. Draws edge "v" --> "this".
                 *
                 * @param canvas jsGraphics instance
                 * @param v Start vertex
                 */
                foograph.Edge.prototype.draw = function (canvas, v) {
                    var x1 = Math.round(v.x + v.style.width / 2);
                    var y1 = Math.round(v.y + v.style.height / 2);
                    var x2 = Math.round(this.endVertex.x + this.endVertex.style.width / 2);
                    var y2 = Math.round(this.endVertex.y + this.endVertex.style.height / 2);

                    // Control point (needed only for curved edges)
                    var x3 = this.controlX;
                    var y3 = this.controlY;

                    // Arrow tip and angle
                    var X_TIP, Y_TIP, ANGLE;

                    /* Quadric Bezier curve definition. */
                    function Bx(t) {
                        return (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * x3 + t * t * x2;
                    }
                    function By(t) {
                        return (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * y3 + t * t * y2;
                    }

                    canvas.setStroke(this.style.width);
                    canvas.setColor(this.style.color);

                    if (this.curved) { // Draw a quadric Bezier curve
                        this.curved = false; // Reset
                        var t = 0, dt = 1 / 10;
                        var xs = x1, ys = y1, xn, yn;

                        while (t < 1 - dt) {
                            t += dt;
                            xn = Bx(t);
                            yn = By(t);
                            canvas.drawLine(xs, ys, xn, yn);
                            xs = xn;
                            ys = yn;
                        }

                        // Set the arrow tip coordinates
                        X_TIP = xs;
                        Y_TIP = ys;

                        // Move the tip to (0,0) and calculate the angle 
                        // of the arrow head
                        ANGLE = angularCoord(Bx(1 - 2 * dt) - X_TIP, By(1 - 2 * dt) - Y_TIP);

                    } else {
                        canvas.drawLine(x1, y1, x2, y2);

                        // Set the arrow tip coordinates
                        X_TIP = x2;
                        Y_TIP = y2;

                        // Move the tip to (0,0) and calculate the angle 
                        // of the arrow head
                        ANGLE = angularCoord(x1 - X_TIP, y1 - Y_TIP);
                    }

                    if (this.style.showArrow) {
                        drawArrow(ANGLE, X_TIP, Y_TIP);
                    }

                    // TODO
                    if (this.style.showLabel) {
                    }

                    /** 
                     * Draws an edge arrow. 
                     * @param phi The angle (in radians) of the arrow in polar coordinates. 
                     * @param x X coordinate of the arrow tip.
                     * @param y Y coordinate of the arrow tip.
                     */
                    function drawArrow(phi, x, y)
                    {
                        // Arrow bounding box (in px)
                        var H = 50;
                        var W = 10;

                        // Set cartesian coordinates of the arrow
                        var p11 = 0, p12 = 0;
                        var p21 = H, p22 = W / 2;
                        var p31 = H, p32 = -W / 2;

                        // Convert to polar coordinates
                        var r2 = radialCoord(p21, p22);
                        var r3 = radialCoord(p31, p32);
                        var phi2 = angularCoord(p21, p22);
                        var phi3 = angularCoord(p31, p32);

                        // Rotate the arrow
                        phi2 += phi;
                        phi3 += phi;

                        // Update cartesian coordinates
                        p21 = r2 * Math.cos(phi2);
                        p22 = r2 * Math.sin(phi2);
                        p31 = r3 * Math.cos(phi3);
                        p32 = r3 * Math.sin(phi3);

                        // Translate
                        p11 += x;
                        p12 += y;
                        p21 += x;
                        p22 += y;
                        p31 += x;
                        p32 += y;

                        // Draw
                        canvas.fillPolygon(new Array(p11, p21, p31), new Array(p12, p22, p32));
                    }

                    /** 
                     * Get the angular coordinate.
                     * @param x X coordinate
                     * @param y Y coordinate
                     */
                    function angularCoord(x, y)
                    {
                        var phi = 0.0;

                        if (x > 0 && y >= 0) {
                            phi = Math.atan(y / x);
                        }
                        if (x > 0 && y < 0) {
                            phi = Math.atan(y / x) + 2 * Math.PI;
                        }
                        if (x < 0) {
                            phi = Math.atan(y / x) + Math.PI;
                        }
                        if (x = 0 && y > 0) {
                            phi = Math.PI / 2;
                        }
                        if (x = 0 && y < 0) {
                            phi = 3 * Math.PI / 2;
                        }

                        return phi;
                    }

                    /** 
                     * Get the radian coordiante.
                     * @param x1 
                     * @param y1 
                     * @param x2
                     * @param y2 
                     */
                    function radialCoord(x, y)
                    {
                        return Math.sqrt(x * x + y * y);
                    }
                };

                /**
                 * Calculates the coordinates based on pure chance.
                 *
                 * @param graph A valid graph instance
                 */
                foograph.RandomVertexLayout.prototype.layout = function (graph) {
                    for (var i = 0; i < graph.vertices.length; i++) {
                        var v = graph.vertices[i];
                        v.x = Math.round(Math.random() * this.width);
                        v.y = Math.round(Math.random() * this.height);
                    }
                };

                /**
                 * Identifies connected components of a graph and creates "central"
                 * vertices for each component. If there is more than one component,
                 * all central vertices of individual components are connected to
                 * each other to prevent component drift.
                 *
                 * @param graph A valid graph instance
                 * @return A list of component center vertices or null when there
                 *         is only one component.
                 */
                foograph.ForceDirectedVertexLayout.prototype.__identifyComponents = function (graph) {
                    var componentCenters = new Array();
                    var components = new Array();

                    // Depth first search
                    function dfs(vertex)
                    {
                        var stack = new Array();
                        var component = new Array();
                        var centerVertex = new foograph.Vertex("component_center", -1, -1);
                        centerVertex.hidden = true;
                        componentCenters.push(centerVertex);
                        components.push(component);

                        function visitVertex(v)
                        {
                            component.push(v);
                            v.__dfsVisited = true;

                            for (var i in v.edges) {
                                var e = v.edges[i];
                                if (!e.hidden)
                                    stack.push(e.endVertex);
                            }

                            for (var i in v.reverseEdges) {
                                if (!v.reverseEdges[i].hidden)
                                    stack.push(v.reverseEdges[i].endVertex);
                            }
                        }

                        visitVertex(vertex);
                        while (stack.length > 0) {
                            var u = stack.pop();

                            if (!u.__dfsVisited && !u.hidden) {
                                visitVertex(u);
                            }
                        }
                    }

                    // Clear DFS visited flag
                    for (var i in graph.vertices) {
                        var v = graph.vertices[i];
                        v.__dfsVisited = false;
                    }

                    // Iterate through all vertices starting DFS from each vertex
                    // that hasn't been visited yet.
                    for (var k in graph.vertices) {
                        var v = graph.vertices[k];
                        if (!v.__dfsVisited && !v.hidden)
                            dfs(v);
                    }

                    // Interconnect all center vertices
                    if (componentCenters.length > 1) {
                        for (var i in componentCenters) {
                            graph.insertVertex(componentCenters[i]);
                        }
                        for (var i in components) {
                            for (var j in components[i]) {
                                // Connect visited vertex to "central" component vertex
                                edge = graph.insertEdge("", 1, components[i][j], componentCenters[i]);
                                edge.hidden = true;
                            }
                        }

                        for (var i in componentCenters) {
                            for (var j in componentCenters) {
                                if (i != j) {
                                    e = graph.insertEdge("", 3, componentCenters[i], componentCenters[j]);
                                    e.hidden = true;
                                }
                            }
                        }

                        return componentCenters;
                    }

                    return null;
                };

                /**
                 * Calculates the coordinates based on force-directed placement
                 * algorithm.
                 *
                 * @param graph A valid graph instance
                 */
                foograph.ForceDirectedVertexLayout.prototype.layout = function (graph) {


                    this.graph = graph;
                    var area = this.width * this.height;
                    var k = Math.sqrt(area / 45);

                    var t = this.width / 10; // Temperature.
                    var dt = t / (this.iterations + 1);

                    var eps = this.eps; // Minimum distance between the vertices

                    // Attractive and repulsive forces
                    function Fa(z) {
                        return foograph.A * z * z / k;
                    }
                    function Fr(z) {
                        return foograph.R * k * k / z;
                    }
                    function Fw(z) {
                        return 1 / z * z;
                    }  // Force emited by the walls

                    // Initiate component identification and virtual vertex creation
                    // to prevent disconnected graph components from drifting too far apart
                    centers = this.__identifyComponents(graph);


                    // Assign initial random positions
                    if (this.randomize) {
                        randomLayout = new foograph.RandomVertexLayout(this.width, this.height);
                        randomLayout.layout(graph);
                    }



                    // Run through some iterations
                    for (var q = 0; q < this.iterations; q++) {

                        /* Calculate repulsive forces. */
                        for (var i1 in graph.verticesdiv) {
                            var v = graph.vertices[i1];
                            v.dx = 0;
                            v.dy = 0;

                            // Do not move fixed vertices
                            if (!v.fixed) {
                                for (var i2 in graph.vertices) {
                                    var u = graph.vertices[i2];
                                    if (v != u && !u.fixed) {
                                        /* Difference vector between the two vertices. */
                                        var difx = v.x - u.x;
                                        var dify = v.y - u.y;

                                        /* Length of the dif vector. */
                                        var d = Math.max(eps, Math.sqrt(difx * difx + dify * dify));
                                        var force = Fr(d);
                                        v.dx = v.dx + (difx / d) * force;
                                        v.dy = v.dy + (dify / d) * force;

                                    }


                                }
                            }

                        }
                        for (var i3 in graph.verticesdiv) {
                            var v = graph.vertices[i3];
                            if (!v.fixed) {
                                for (var i4 in v.edges) {
                                    var e = v.edges[i4];
                                    var u = e.endVertex;
                                    var difx = v.x - u.x;
                                    var dify = v.y - u.y;
                                    var d = Math.max(eps, Math.sqrt(difx * difx + dify * dify));
                                    var force = Fa(d);
                                    var d = Math.max(eps, Math.sqrt(difx * difx + dify * dify));
                                    v.dx = v.dx - (difx / d) * force;
                                    v.dy = v.dy - (dify / d) * force;

                                    u.dx = u.dx + (difx / d) * force;
                                    u.dy = u.dy + (dify / d) * force;
                                }
                            }
                        }
                        for (var i5 in graph.verticesdiv) {
                            var v = graph.vertices[i5];
                            if (!v.fixed) {
                                var d = Math.max(eps, Math.sqrt(v.dx * v.dx + v.dy * v.dy));
                                v.x = v.x + (v.dx / d) * Math.min(d, t);
                                v.y = v.y + (v.dy / d) * Math.min(d, t);
                                v.x = Math.round(v.x);
                                v.y = Math.round(v.y);


                            }
                        }


                        t -= dt;
                        if (q % 10 == 0) {
                            this.callback();
                        }
                    }


                    if (centers) {
                        for (var i in centers) {
                            graph.removeVertex(centers[i]);
                        }
                    }

                    graph.normalize(this.width, this.height, true);




                };
//IMPLEMENTATION
                var lWidth = pData['width'];
                var lHeight = pData['height'];
                var lMinDist = pData['minDist'];
                var lExpFact = pData['expFact'];
                var lMaxExpIt = pData['maxExpIt'];
                var numworker = pData['numworker'];
                /*
                 * FIRST STEP: Application of the Fruchterman-Reingold algorithm
                 *
                 * We use the version implemented by the foograph library
                 *  
                 * Ref.: https://code.google.com/p/foograph/
                 */

                // We need to create an instance of a graph compatible with the library
                var frg = new foograph.Graph("FRgraph", false);

                var frgNodes = {};

                // Then we have to add the vertices
                var dataVertices = pData['vertices'];
                for (var ni = 0; ni < dataVertices.length; ++ni) {
                    var id = dataVertices[ni]['id'];
                    var v = new foograph.Vertex(id, Math.round(Math.random() * lHeight), Math.round(Math.random() * lHeight));
                    frgNodes[id] = v;
                    frg.insertVertex(v);
                }

                var dataEdges = pData['edges'];
                for (var ei = 0; ei < dataEdges.length; ++ei) {
                    var srcNodeId = dataEdges[ei]['src'];
                    var tgtNodeId = dataEdges[ei]['tgt'];
                    frg.insertEdge("", 1, frgNodes[srcNodeId], frgNodes[tgtNodeId]);
                }

                var frgNodes = {};
                var dataVertices = pData['verticesdiv'][2];
                for (var ni = 0; ni < dataVertices.length; ++ni) {
                    var id = dataVertices[ni]['id'];
                    var v = new foograph.Vertex(id, Math.round(Math.random() * lHeight), Math.round(Math.random() * lHeight));
                    frgNodes[id] = v;
                    frg.insertVertexdiv(v);
                }
                var fv = frg.vertices;
                var frLayoutManager = new foograph.ForceDirectedVertexLayout(lWidth, lHeight, 400, false, 20);
                frLayoutManager.layout(frg);
                var rfv = [];
                    var inarray=[];
                dataVertices.forEach(function(node){
                        inarray.push(node.id);
                    });
                for (var i = 0; i < fv.length; ++i) {
                       inarray.forEach(
                            function(idnode){
                                if(idnode==fv[i].label)
                                { 
                                    
                                     rfv.push(fv[i]);
                                 }
                        });   
                            
                }
        broadcast(rfv);        
});
t3.on('message', function( e ){
           
              fv   =  fv.concat(e.message);
              if (fv.length== nodes.length){         
                var lWidth = pData['width'];
                var lHeight = pData['height'];
                var lMinDist = pData['minDist'];
                var lExpFact = pData['expFact'];
                var lMaxExpIt = pData['maxExpIt'];
                var numworker = pData['numworker'];
               // We calculate the Voronoi diagram dor the position of the nodes
                var voronoi = new Voronoi();
                var bbox = {xl: 0, xr: lWidth, yt: 0, yb: lHeight};
                var vSites = [];
                for (var i = 0; i < fv.length; ++i) {
                    vSites[fv[i].label] = fv[i];
                }

                function checkMinDist(ee) {
                    var infractions = 0;
                    // Then we check if the minimum distance is satisfied
                    for (var eei = 0; eei < ee.length; ++eei) {
                        var e = ee[eei];
                        if ((e.lSite != null) && (e.rSite != null) && sitesDistance(e.lSite, e.rSite) < lMinDist) {
                            ++infractions;
                        }
                    }
                    return infractions;
                }

                var diagram = voronoi.compute(fv, bbox);

                // Then we reposition the nodes at the centroid of their Voronoi cells
                var cells = diagram.cells;
                for (var i = 0; i < cells.length; ++i) {
                    var cell = cells[i];
                    var site = cell.site;
                    var centroid = cellCentroid(cell);
                    var currv = vSites[site.label];
                    currv.x = centroid.x;
                    currv.y = centroid.y;
                }

                if (lExpFact < 0.0) {
                    // Calculates the expanding factor
                    lExpFact = Math.max(0.05, Math.min(0.10, lMinDist / Math.sqrt((lWidth * lHeight) / fv.length) * 0.5));
                    //console.info("Expanding factor is " + (options.expandingFactor * 100.0) + "%");
                }

                var prevInfractions = checkMinDist(diagram.edges);
                //console.info("Initial infractions " + prevInfractions);

                var bStop = (prevInfractions <= 0);

                var voronoiIteration = 0;
                var expandIteration = 0;

                var initWidth = lWidth;

                while (!bStop) {
                    ++voronoiIteration;
                    for (var it = 0; it <= 4; ++it) {
                        voronoi.recycle(diagram);
                        diagram = voronoi.compute(fv, bbox);

                        // Then we reposition the nodes at the centroid of their Voronoi cells
                        cells = diagram.cells;
                        for (var i = 0; i < cells.length; ++i) {
                            var cell = cells[i];
                            var site = cell.site;
                            var centroid = cellCentroid(cell);
                            var currv = vSites[site.label];
                            currv.x = centroid.x;
                            currv.y = centroid.y;
                        }
                    }

                    var currInfractions = checkMinDist(diagram.edges);
                    //console.info("Current infractions " + currInfractions);

                    if (currInfractions <= 0) {
                        bStop = true;
                    } else {
                        if (currInfractions >= prevInfractions || voronoiIteration >= 4) {
                            if (expandIteration >= lMaxExpIt) {
                                bStop = true;
                            } else {
                                lWidth += lWidth * lExpFact;
                                lHeight += lHeight * lExpFact;
                                bbox = {xl: 0, xr: lWidth, yt: 0, yb: lHeight};
                                ++expandIteration;
                                voronoiIteration = 0;
                                //console.info("Expanded to ("+width+","+height+")");
                            }
                        }
                    }
                    prevInfractions = currInfractions;
                }
                // Prepare the data to output
                pData['width'] = lWidth;
                pData['height'] = lHeight;
                pData['expIt'] = expandIteration;
                pData['expFact'] = lExpFact;

                pData['vertices'] = [];
                    
                    
                for (var i = 0; i < fv.length; ++i) {
                       
                    pData['vertices'].push({id: fv[i].label, x: fv[i].x, y: fv[i].y}); 
                }
                
                
                 // First we retrieve the important data
            var expandIteration = pData['expIt'];
            var dataVertices = pData['vertices'];
           var vertices = [];
            for (var i = 0; i < dataVertices.length; ++i) {
                var dv = dataVertices[i];
           vertices[dv.id] = {x: dv.x, y: dv.y};
            } 
            allNodes.positions(
                    function (i, node) {
                        var pos = node._private.position;
                        pos.x = simBB.x1;
                        pos.y = simBB.y1;

                    });

            nodes.positions(
                    function (i, node) {
                        var id = node._private.data.id;
                        var pos = node._private.position;
                        var vertex = vertices[id];
                       
                       
                        pos.x = Math.round(simBB.x1 + vertex.x);
                        pos.y = Math.round(simBB.y1 + vertex.y);
                    });

            if (options.fit && expandIteration > 0) {
                cy.fit(options.padding);
            } else {
                cy.reset();
            }
            cy.nodes().rtrigger("position");
            // Get end time
            var startTime = pData['startTime'];
            var endTime = new Date();
            console.info("Layout on " + dataVertices.length + " nodes took " + (endTime - startTime) + " ms");
            layout.one("layoutstop", options.stop);
            layout.trigger("layoutstop"); 
            }
    t3.stop();
});
// 4th worker


        t4.pass(pData).run(function (pData) {



                /*
                 * FIRST STEP: Application of the Fruchterman-Reingold algorithm
                 *
                 * We use the version implemented by the foograph library
                 *  
                 * Ref.: https://code.google.com/p/foograph/
                 */
                var foograph = {
                    /**
                     * Insert a vertex into this graph.
                     * 
                     * @param vertex A valid Vertex instance
                     */
                    insertVertex: function (vertex) {
                        this.vertices.push(vertex);
                        this.vertexCount++;
                    },
                    insertVertexdiv: function (vertex) {
                        this.verticesdiv.push(vertex);
                        this.vertexCountdiv++;
                    },
                    /**
                     * Insert an edge vertex1 --> vertex2.
                     *  
                     * @param label Label for this edge
                     * @param weight Weight of this edge
                     * @param vertex1 Starting Vertex instance
                     * @param vertex2 Ending Vertex instance
                     * @return Newly created Edge instance
                     */
                    insertEdge: function (label, weight, vertex1, vertex2, style) {
                        var e1 = new foograph.Edge(label, weight, vertex2, style);
                        var e2 = new foograph.Edge(null, weight, vertex1, null);

                        vertex1.edges.push(e1);
                        vertex2.reverseEdges.push(e2);

                        return e1;
                    },
                    /** 
                     * Delete edge.
                     *
                     * @param vertex Starting vertex
                     * @param edge Edge to remove
                     */
                    removeEdge: function (vertex1, vertex2) {
                        for (var i = vertex1.edges.length - 1; i >= 0; i--) {
                            if (vertex1.edges[i].endVertex == vertex2) {
                                vertex1.edges.splice(i, 1);
                                break;
                            }
                        }

                        for (var i = vertex2.reverseEdges.length - 1; i >= 0; i--) {
                            if (vertex2.reverseEdges[i].endVertex == vertex1) {
                                vertex2.reverseEdges.splice(i, 1);
                                break;
                            }
                        }
                    },
                    /** 
                     * Delete vertex.
                     *
                     * @param vertex Vertex to remove from the graph
                     */
                    removeVertex: function (vertex) {
                        for (var i = vertex.edges.length - 1; i >= 0; i--) {
                            this.removeEdge(vertex, vertex.edges[i].endVertex);
                        }

                        for (var i = vertex.reverseEdges.length - 1; i >= 0; i--) {
                            this.removeEdge(vertex.reverseEdges[i].endVertex, vertex);
                        }

                        for (var i = this.vertices.length - 1; i >= 0; i--) {
                            if (this.vertices[i] == vertex) {
                                this.vertices.splice(i, 1);
                                break;
                            }
                        }

                        this.vertexCount--;
                    },
                    /**
                     * Plots this graph to a canvas.
                     *
                     * @param canvas A proper canvas instance
                     */
                    plot: function (canvas) {
                        var i = 0;
                        /* Draw edges first */
                        for (i = 0; i < this.vertices.length; i++) {
                            var v = this.vertices[i];
                            if (!v.hidden) {
                                for (var j = 0; j < v.edges.length; j++) {
                                    var e = v.edges[j];
                                    /* Draw edge (if not hidden) */
                                    if (!e.hidden)
                                        e.draw(canvas, v);
                                }
                            }
                        }

                        /* Draw the vertices. */
                        for (i = 0; i < this.vertices.length; i++) {
                            v = this.vertices[i];

                            /* Draw vertex (if not hidden) */
                            if (!v.hidden)
                                v.draw(canvas);
                        }
                    },
                    /**
                     * Graph object constructor.
                     * 
                     * @param label Label of this graph
                     * @param directed true or false
                     */
                    Graph: function (label, directed) {
                        /* Fields. */
                        this.label = label;
                        this.vertices = new Array();
                        this.directed = directed;
                        this.vertexCount = 0;
                        this.verticesdiv = new Array();
                        /* Graph methods. */
                        this.insertVertex = foograph.insertVertex;
                        this.insertVertexdiv = foograph.insertVertexdiv;
                        this.removeVertex = foograph.removeVertex;
                        this.insertEdge = foograph.insertEdge;
                        this.removeEdge = foograph.removeEdge;
                        this.plot = foograph.plot;
                    },
                    /**
                     * Vertex object constructor.
                     * 
                     * @param label Label of this vertex
                     * @param next Reference to the next vertex of this graph
                     * @param firstEdge First edge of a linked list of edges
                     */
                    Vertex: function (label, x, y, style) {
                        this.label = label;
                        this.edges = new Array();
                        this.reverseEdges = new Array();
                        this.x = x;
                        this.y = y;
                        this.dx = 0;
                        this.dy = 0;
                        this.level = -1;
                        this.numberOfParents = 0;
                        this.hidden = false;
                        this.fixed = false;     // Fixed vertices are static (unmovable)

                        if (style != null) {
                            this.style = style;
                        }
                        else { // Default
                            this.style = new foograph.VertexStyle('ellipse', 80, 40, '#ffffff', '#000000', true);
                        }
                    },
                    /**
                     * VertexStyle object type for defining vertex style options.
                     *
                     * @param shape Shape of the vertex ('ellipse' or 'rect')
                     * @param width Width in px
                     * @param height Height in px
                     * @param fillColor The color with which the vertex is drawn (RGB HEX string)
                     * @param borderColor The color with which the border of the vertex is drawn (RGB HEX string)
                     * @param showLabel Show the vertex label or not
                     */
                    VertexStyle: function (shape, width, height, fillColor, borderColor, showLabel) {
                        this.shape = shape;
                        this.width = width;
                        this.height = height;
                        this.fillColor = fillColor;
                        this.borderColor = borderColor;
                        this.showLabel = showLabel;
                    },
                    /**
                     * Edge object constructor.
                     *
                     * @param label Label of this edge
                     * @param next Next edge reference
                     * @param weight Edge weight
                     * @param endVertex Destination Vertex instance
                     */
                    Edge: function (label, weight, endVertex, style) {
                        this.label = label;
                        this.weight = weight;
                        this.endVertex = endVertex;
                        this.style = null;
                        this.hidden = false;

                        // Curving information
                        this.curved = false;
                        this.controlX = -1;   // Control coordinates for Bezier curve drawing
                        this.controlY = -1;
                        this.original = null; // If this is a temporary edge it holds the original edge

                        if (style != null) {
                            this.style = style;
                        }
                        else {  // Set to default
                            this.style = new foograph.EdgeStyle(2, '#000000', true, false);
                        }
                    },
                    /**
                     * EdgeStyle object type for defining vertex style options.
                     *
                     * @param width Edge line width
                     * @param color The color with which the edge is drawn
                     * @param showArrow Draw the edge arrow (only if directed)
                     * @param showLabel Show the edge label or not
                     */
                    EdgeStyle: function (width, color, showArrow, showLabel) {
                        this.width = width;
                        this.color = color;
                        this.showArrow = showArrow;
                        this.showLabel = showLabel;
                    },
                    /**
                     * This file is part of foograph Javascript graph library.
                     *
                     * Description: Random vertex layout manager
                     */

                    /**
                     * Class constructor.
                     *
                     * @param width Layout width
                     * @param height Layout height
                     */
                    RandomVertexLayout: function (width, height) {
                        this.width = width;
                        this.height = height;
                    },
                    /**
                     * This file is part of foograph Javascript graph library.
                     *
                     * Description: Fruchterman-Reingold force-directed vertex
                     *              layout manager
                     */

                    /**
                     * Class constructor.
                     *
                     * @param width Layout width
                     * @param height Layout height
                     * @param iterations Number of iterations -
                     * with more iterations it is more likely the layout has converged into a static equilibrium.
                     */
                    ForceDirectedVertexLayout: function (width, height, iterations, randomize, eps) {
                        this.width = width;
                        this.height = height;
                        this.iterations = iterations;
                        this.randomize = randomize;
                        this.eps = eps;
                        this.callback = function () {
                        };
                    },
                    A: 1.5, // Fine tune attraction

                    R: 0.5  // Fine tune repulsion
                };

                /**
                 * toString overload for easier debugging
                 */
                foograph.Vertex.prototype.toString = function () {
                    return "[v:" + this.label + "] ";
                };

                /**
                 * toString overload for easier debugging
                 */
                foograph.Edge.prototype.toString = function () {
                    return "[e:" + this.endVertex.label + "] ";
                };

                /**
                 * Draw vertex method.
                 *
                 * @param canvas jsGraphics instance
                 */
                foograph.Vertex.prototype.draw = function (canvas) {
                    var x = this.x;
                    var y = this.y;
                    var width = this.style.width;
                    var height = this.style.height;
                    var shape = this.style.shape;

                    canvas.setStroke(2);
                    canvas.setColor(this.style.fillColor);

                    if (shape == 'rect') {
                        canvas.fillRect(x, y, width, height);
                        canvas.setColor(this.style.borderColor);
                        canvas.drawRect(x, y, width, height);
                    }
                    else { // Default to ellipse
                        canvas.fillEllipse(x, y, width, height);
                        canvas.setColor(this.style.borderColor);
                        canvas.drawEllipse(x, y, width, height);
                    }

                    if (this.style.showLabel) {
                        canvas.drawStringRect(this.label, x, y + height / 2 - 7, width, 'center');
                    }
                };

                /**
                 * Fits the graph into the bounding box
                 *
                 * @param width
                 * @param height
                 * @param preserveAspect
                 */
                foograph.Graph.prototype.normalize = function (width, height, preserveAspect) {
                    for (var i8 in this.vertices) {
                        var v = this.vertices[i8];
                        v.oldX = v.x;
                        v.oldY = v.y;
                    }
                    var mnx = width * 0.1;
                    var mxx = width * 0.9;
                    var mny = height * 0.1;
                    var mxy = height * 0.9;
                    if (preserveAspect == null)
                        preserveAspect = true;

                    var minx = Number.MAX_VALUE;
                    var miny = Number.MAX_VALUE;
                    var maxx = Number.MIN_VALUE;
                    var maxy = Number.MIN_VALUE;

                    for (var i7 in this.vertices) {
                        var v = this.vertices[i7];
                        if (v.x < minx)
                            minx = v.x;
                        if (v.y < miny)
                            miny = v.y;
                        if (v.x > maxx)
                            maxx = v.x;
                        if (v.y > maxy)
                            maxy = v.y;
                    }
                    var kx = (mxx - mnx) / (maxx - minx);
                    var ky = (mxy - mny) / (maxy - miny);

                    if (preserveAspect) {
                        kx = Math.min(kx, ky);
                        ky = Math.min(kx, ky);
                    }

                    var newMaxx = Number.MIN_VALUE;
                    var newMaxy = Number.MIN_VALUE;
                    for (var i8 in this.vertices) {
                        var v = this.vertices[i8];
                        v.x = (v.x - minx) * kx;
                        v.y = (v.y - miny) * ky;
                        if (v.x > newMaxx)
                            newMaxx = v.x;
                        if (v.y > newMaxy)
                            newMaxy = v.y;
                    }

                    var dx = (width - newMaxx) / 2.0;
                    var dy = (height - newMaxy) / 2.0;
                    for (var i8 in this.vertices) {
                        var v = this.vertices[i8];
                        v.x += dx;
                        v.y += dy;
                    }
                };

                /**
                 * Draw edge method. Draws edge "v" --> "this".
                 *
                 * @param canvas jsGraphics instance
                 * @param v Start vertex
                 */
                foograph.Edge.prototype.draw = function (canvas, v) {
                    var x1 = Math.round(v.x + v.style.width / 2);
                    var y1 = Math.round(v.y + v.style.height / 2);
                    var x2 = Math.round(this.endVertex.x + this.endVertex.style.width / 2);
                    var y2 = Math.round(this.endVertex.y + this.endVertex.style.height / 2);

                    // Control point (needed only for curved edges)
                    var x3 = this.controlX;
                    var y3 = this.controlY;

                    // Arrow tip and angle
                    var X_TIP, Y_TIP, ANGLE;

                    /* Quadric Bezier curve definition. */
                    function Bx(t) {
                        return (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * x3 + t * t * x2;
                    }
                    function By(t) {
                        return (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * y3 + t * t * y2;
                    }

                    canvas.setStroke(this.style.width);
                    canvas.setColor(this.style.color);

                    if (this.curved) { // Draw a quadric Bezier curve
                        this.curved = false; // Reset
                        var t = 0, dt = 1 / 10;
                        var xs = x1, ys = y1, xn, yn;

                        while (t < 1 - dt) {
                            t += dt;
                            xn = Bx(t);
                            yn = By(t);
                            canvas.drawLine(xs, ys, xn, yn);
                            xs = xn;
                            ys = yn;
                        }

                        // Set the arrow tip coordinates
                        X_TIP = xs;
                        Y_TIP = ys;

                        // Move the tip to (0,0) and calculate the angle 
                        // of the arrow head
                        ANGLE = angularCoord(Bx(1 - 2 * dt) - X_TIP, By(1 - 2 * dt) - Y_TIP);

                    } else {
                        canvas.drawLine(x1, y1, x2, y2);

                        // Set the arrow tip coordinates
                        X_TIP = x2;
                        Y_TIP = y2;

                        // Move the tip to (0,0) and calculate the angle 
                        // of the arrow head
                        ANGLE = angularCoord(x1 - X_TIP, y1 - Y_TIP);
                    }

                    if (this.style.showArrow) {
                        drawArrow(ANGLE, X_TIP, Y_TIP);
                    }

                    // TODO
                    if (this.style.showLabel) {
                    }

                    /** 
                     * Draws an edge arrow. 
                     * @param phi The angle (in radians) of the arrow in polar coordinates. 
                     * @param x X coordinate of the arrow tip.
                     * @param y Y coordinate of the arrow tip.
                     */
                    function drawArrow(phi, x, y)
                    {
                        // Arrow bounding box (in px)
                        var H = 50;
                        var W = 10;

                        // Set cartesian coordinates of the arrow
                        var p11 = 0, p12 = 0;
                        var p21 = H, p22 = W / 2;
                        var p31 = H, p32 = -W / 2;

                        // Convert to polar coordinates
                        var r2 = radialCoord(p21, p22);
                        var r3 = radialCoord(p31, p32);
                        var phi2 = angularCoord(p21, p22);
                        var phi3 = angularCoord(p31, p32);

                        // Rotate the arrow
                        phi2 += phi;
                        phi3 += phi;

                        // Update cartesian coordinates
                        p21 = r2 * Math.cos(phi2);
                        p22 = r2 * Math.sin(phi2);
                        p31 = r3 * Math.cos(phi3);
                        p32 = r3 * Math.sin(phi3);

                        // Translate
                        p11 += x;
                        p12 += y;
                        p21 += x;
                        p22 += y;
                        p31 += x;
                        p32 += y;

                        // Draw
                        canvas.fillPolygon(new Array(p11, p21, p31), new Array(p12, p22, p32));
                    }

                    /** 
                     * Get the angular coordinate.
                     * @param x X coordinate
                     * @param y Y coordinate
                     */
                    function angularCoord(x, y)
                    {
                        var phi = 0.0;

                        if (x > 0 && y >= 0) {
                            phi = Math.atan(y / x);
                        }
                        if (x > 0 && y < 0) {
                            phi = Math.atan(y / x) + 2 * Math.PI;
                        }
                        if (x < 0) {
                            phi = Math.atan(y / x) + Math.PI;
                        }
                        if (x = 0 && y > 0) {
                            phi = Math.PI / 2;
                        }
                        if (x = 0 && y < 0) {
                            phi = 3 * Math.PI / 2;
                        }

                        return phi;
                    }

                    /** 
                     * Get the radian coordiante.
                     * @param x1 
                     * @param y1 
                     * @param x2
                     * @param y2 
                     */
                    function radialCoord(x, y)
                    {
                        return Math.sqrt(x * x + y * y);
                    }
                };

                /**
                 * Calculates the coordinates based on pure chance.
                 *
                 * @param graph A valid graph instance
                 */
                foograph.RandomVertexLayout.prototype.layout = function (graph) {
                    for (var i = 0; i < graph.vertices.length; i++) {
                        var v = graph.vertices[i];
                        v.x = Math.round(Math.random() * this.width);
                        v.y = Math.round(Math.random() * this.height);
                    }
                };

                /**
                 * Identifies connected components of a graph and creates "central"
                 * vertices for each component. If there is more than one component,
                 * all central vertices of individual components are connected to
                 * each other to prevent component drift.
                 *
                 * @param graph A valid graph instance
                 * @return A list of component center vertices or null when there
                 *         is only one component.
                 */
                foograph.ForceDirectedVertexLayout.prototype.__identifyComponents = function (graph) {
                    var componentCenters = new Array();
                    var components = new Array();

                    // Depth first search
                    function dfs(vertex)
                    {
                        var stack = new Array();
                        var component = new Array();
                        var centerVertex = new foograph.Vertex("component_center", -1, -1);
                        centerVertex.hidden = true;
                        componentCenters.push(centerVertex);
                        components.push(component);

                        function visitVertex(v)
                        {
                            component.push(v);
                            v.__dfsVisited = true;

                            for (var i in v.edges) {
                                var e = v.edges[i];
                                if (!e.hidden)
                                    stack.push(e.endVertex);
                            }

                            for (var i in v.reverseEdges) {
                                if (!v.reverseEdges[i].hidden)
                                    stack.push(v.reverseEdges[i].endVertex);
                            }
                        }

                        visitVertex(vertex);
                        while (stack.length > 0) {
                            var u = stack.pop();

                            if (!u.__dfsVisited && !u.hidden) {
                                visitVertex(u);
                            }
                        }
                    }

                    // Clear DFS visited flag
                    for (var i in graph.vertices) {
                        var v = graph.vertices[i];
                        v.__dfsVisited = false;
                    }

                    // Iterate through all vertices starting DFS from each vertex
                    // that hasn't been visited yet.
                    for (var k in graph.vertices) {
                        var v = graph.vertices[k];
                        if (!v.__dfsVisited && !v.hidden)
                            dfs(v);
                    }

                    // Interconnect all center vertices
                    if (componentCenters.length > 1) {
                        for (var i in componentCenters) {
                            graph.insertVertex(componentCenters[i]);
                        }
                        for (var i in components) {
                            for (var j in components[i]) {
                                // Connect visited vertex to "central" component vertex
                                edge = graph.insertEdge("", 1, components[i][j], componentCenters[i]);
                                edge.hidden = true;
                            }
                        }

                        for (var i in componentCenters) {
                            for (var j in componentCenters) {
                                if (i != j) {
                                    e = graph.insertEdge("", 3, componentCenters[i], componentCenters[j]);
                                    e.hidden = true;
                                }
                            }
                        }

                        return componentCenters;
                    }

                    return null;
                };

                /**
                 * Calculates the coordinates based on force-directed placement
                 * algorithm.
                 *
                 * @param graph A valid graph instance
                 */
                foograph.ForceDirectedVertexLayout.prototype.layout = function (graph) {


                    this.graph = graph;
                    var area = this.width * this.height;
                    var k = Math.sqrt(area / 45);

                    var t = this.width / 10; // Temperature.
                    var dt = t / (this.iterations + 1);

                    var eps = this.eps; // Minimum distance between the vertices

                    // Attractive and repulsive forces
                    function Fa(z) {
                        return foograph.A * z * z / k;
                    }
                    function Fr(z) {
                        return foograph.R * k * k / z;
                    }
                    function Fw(z) {
                        return 1 / z * z;
                    }  // Force emited by the walls

                    // Initiate component identification and virtual vertex creation
                    // to prevent disconnected graph components from drifting too far apart
                    centers = this.__identifyComponents(graph);


                    // Assign initial random positions
                    if (this.randomize) {
                        randomLayout = new foograph.RandomVertexLayout(this.width, this.height);
                        randomLayout.layout(graph);
                    }



                    // Run through some iterations
                    for (var q = 0; q < this.iterations; q++) {

                        /* Calculate repulsive forces. */
                        for (var i1 in graph.verticesdiv) {
                            var v = graph.vertices[i1];
                            v.dx = 0;
                            v.dy = 0;

                            // Do not move fixed vertices
                            if (!v.fixed) {
                                for (var i2 in graph.vertices) {
                                    var u = graph.vertices[i2];
                                    if (v != u && !u.fixed) {
                                        /* Difference vector between the two vertices. */
                                        var difx = v.x - u.x;
                                        var dify = v.y - u.y;

                                        /* Length of the dif vector. */
                                        var d = Math.max(eps, Math.sqrt(difx * difx + dify * dify));
                                        var force = Fr(d);
                                        v.dx = v.dx + (difx / d) * force;
                                        v.dy = v.dy + (dify / d) * force;

                                    }


                                }
                            }

                        }
                        for (var i3 in graph.verticesdiv) {
                            var v = graph.vertices[i3];
                            if (!v.fixed) {
                                for (var i4 in v.edges) {
                                    var e = v.edges[i4];
                                    var u = e.endVertex;
                                    var difx = v.x - u.x;
                                    var dify = v.y - u.y;
                                    var d = Math.max(eps, Math.sqrt(difx * difx + dify * dify));
                                    var force = Fa(d);
                                    var d = Math.max(eps, Math.sqrt(difx * difx + dify * dify));
                                    v.dx = v.dx - (difx / d) * force;
                                    v.dy = v.dy - (dify / d) * force;

                                    u.dx = u.dx + (difx / d) * force;
                                    u.dy = u.dy + (dify / d) * force;
                                }
                            }
                        }
                        for (var i5 in graph.verticesdiv) {
                            var v = graph.vertices[i5];
                            if (!v.fixed) {
                                var d = Math.max(eps, Math.sqrt(v.dx * v.dx + v.dy * v.dy));
                                v.x = v.x + (v.dx / d) * Math.min(d, t);
                                v.y = v.y + (v.dy / d) * Math.min(d, t);
                                v.x = Math.round(v.x);
                                v.y = Math.round(v.y);


                            }
                        }


                        t -= dt;
                        if (q % 10 == 0) {
                            this.callback();
                        }
                    }


                    if (centers) {
                        for (var i in centers) {
                            graph.removeVertex(centers[i]);
                        }
                    }

                    graph.normalize(this.width, this.height, true);




                };
//IMPLEMENTATION
                var lWidth = pData['width'];
                var lHeight = pData['height'];
                var lMinDist = pData['minDist'];
                var lExpFact = pData['expFact'];
                var lMaxExpIt = pData['maxExpIt'];
                var numworker = pData['numworker'];
                /*
                 * FIRST STEP: Application of the Fruchterman-Reingold algorithm
                 *
                 * We use the version implemented by the foograph library
                 *  
                 * Ref.: https://code.google.com/p/foograph/
                 */

                // We need to create an instance of a graph compatible with the library
                var frg = new foograph.Graph("FRgraph", false);

                var frgNodes = {};

                // Then we have to add the vertices
                var dataVertices = pData['vertices'];
                for (var ni = 0; ni < dataVertices.length; ++ni) {
                    var id = dataVertices[ni]['id'];
                    var v = new foograph.Vertex(id, Math.round(Math.random() * lHeight), Math.round(Math.random() * lHeight));
                    frgNodes[id] = v;
                    frg.insertVertex(v);
                }

                var dataEdges = pData['edges'];
                for (var ei = 0; ei < dataEdges.length; ++ei) {
                    var srcNodeId = dataEdges[ei]['src'];
                    var tgtNodeId = dataEdges[ei]['tgt'];
                    frg.insertEdge("", 1, frgNodes[srcNodeId], frgNodes[tgtNodeId]);
                }

                var frgNodes = {};
                var dataVertices = pData['verticesdiv'][3];
                for (var ni = 0; ni < dataVertices.length; ++ni) {
                    var id = dataVertices[ni]['id'];
                    var v = new foograph.Vertex(id, Math.round(Math.random() * lHeight), Math.round(Math.random() * lHeight));
                    frgNodes[id] = v;
                    frg.insertVertexdiv(v);
                }
                var fv = frg.vertices;
                var frLayoutManager = new foograph.ForceDirectedVertexLayout(lWidth, lHeight, 400, false, 20);
                frLayoutManager.layout(frg);
                var rfv = [];
                    var inarray=[];
                dataVertices.forEach(function(node){
                        inarray.push(node.id);
                    });
                for (var i = 0; i < fv.length; ++i) {
                       inarray.forEach(
                            function(idnode){
                                if(idnode==fv[i].label)
                                { 
                                    
                                     rfv.push(fv[i]);
                                 }
                        });   
                            
                }
        broadcast(rfv);        
});
t4.on('message', function( e ){
          
             fv   =  fv.concat(e.message);
              if (fv.length== nodes.length){         
                var lWidth = pData['width'];
                var lHeight = pData['height'];
                var lMinDist = pData['minDist'];
                var lExpFact = pData['expFact'];
                var lMaxExpIt = pData['maxExpIt'];
                var numworker = pData['numworker'];
               // We calculate the Voronoi diagram dor the position of the nodes
                var voronoi = new Voronoi();
                var bbox = {xl: 0, xr: lWidth, yt: 0, yb: lHeight};
                var vSites = [];
                for (var i = 0; i < fv.length; ++i) {
                    vSites[fv[i].label] = fv[i];
                }

                function checkMinDist(ee) {
                    var infractions = 0;
                    // Then we check if the minimum distance is satisfied
                    for (var eei = 0; eei < ee.length; ++eei) {
                        var e = ee[eei];
                        if ((e.lSite != null) && (e.rSite != null) && sitesDistance(e.lSite, e.rSite) < lMinDist) {
                            ++infractions;
                        }
                    }
                    return infractions;
                }

                var diagram = voronoi.compute(fv, bbox);

                // Then we reposition the nodes at the centroid of their Voronoi cells
                var cells = diagram.cells;
                for (var i = 0; i < cells.length; ++i) {
                    var cell = cells[i];
                    var site = cell.site;
                    var centroid = cellCentroid(cell);
                    var currv = vSites[site.label];
                    currv.x = centroid.x;
                    currv.y = centroid.y;
                }

                if (lExpFact < 0.0) {
                    // Calculates the expanding factor
                    lExpFact = Math.max(0.05, Math.min(0.10, lMinDist / Math.sqrt((lWidth * lHeight) / fv.length) * 0.5));
                    //console.info("Expanding factor is " + (options.expandingFactor * 100.0) + "%");
                }

                var prevInfractions = checkMinDist(diagram.edges);
                //console.info("Initial infractions " + prevInfractions);

                var bStop = (prevInfractions <= 0);

                var voronoiIteration = 0;
                var expandIteration = 0;

                var initWidth = lWidth;

                while (!bStop) {
                    ++voronoiIteration;
                    for (var it = 0; it <= 4; ++it) {
                        voronoi.recycle(diagram);
                        diagram = voronoi.compute(fv, bbox);

                        // Then we reposition the nodes at the centroid of their Voronoi cells
                        cells = diagram.cells;
                        for (var i = 0; i < cells.length; ++i) {
                            var cell = cells[i];
                            var site = cell.site;
                            var centroid = cellCentroid(cell);
                            var currv = vSites[site.label];
                            currv.x = centroid.x;
                            currv.y = centroid.y;
                        }
                    }

                    var currInfractions = checkMinDist(diagram.edges);
                    //console.info("Current infractions " + currInfractions);

                    if (currInfractions <= 0) {
                        bStop = true;
                    } else {
                        if (currInfractions >= prevInfractions || voronoiIteration >= 4) {
                            if (expandIteration >= lMaxExpIt) {
                                bStop = true;
                            } else {
                                lWidth += lWidth * lExpFact;
                                lHeight += lHeight * lExpFact;
                                bbox = {xl: 0, xr: lWidth, yt: 0, yb: lHeight};
                                ++expandIteration;
                                voronoiIteration = 0;
                                //console.info("Expanded to ("+width+","+height+")");
                            }
                        }
                    }
                    prevInfractions = currInfractions;
                }
                // Prepare the data to output
                pData['width'] = lWidth;
                pData['height'] = lHeight;
                pData['expIt'] = expandIteration;
                pData['expFact'] = lExpFact;

                pData['vertices'] = [];
                    
                    
                for (var i = 0; i < fv.length; ++i) {
                       
                    pData['vertices'].push({id: fv[i].label, x: fv[i].x, y: fv[i].y}); 
                }
                
                
                 // First we retrieve the important data
            var expandIteration = pData['expIt'];
            var dataVertices = pData['vertices'];
           var vertices = [];
            for (var i = 0; i < dataVertices.length; ++i) {
                var dv = dataVertices[i];
           vertices[dv.id] = {x: dv.x, y: dv.y};
            } 
            allNodes.positions(
                    function (i, node) {
                        var pos = node._private.position;
                        pos.x = simBB.x1;
                        pos.y = simBB.y1;

                    });

            nodes.positions(
                    function (i, node) {
                        var id = node._private.data.id;
                        var pos = node._private.position;
                        var vertex = vertices[id];
                       
                       
                        pos.x = Math.round(simBB.x1 + vertex.x);
                        pos.y = Math.round(simBB.y1 + vertex.y);
                    });

            if (options.fit && expandIteration > 0) {
                cy.fit(options.padding);
            } else {
                cy.reset();
            }
            cy.nodes().rtrigger("position");
            // Get end time
            var startTime = pData['startTime'];
            var endTime = new Date();
            console.info("Layout on " + dataVertices.length + " nodes took " + (endTime - startTime) + " ms");
            layout.one("layoutstop", options.stop);
            layout.trigger("layoutstop"); 
            }
    t4.stop();
});

        return this;
    };




    SpreadLayout.prototype.stop = function () {
    };

    $$('layout', 'spread', SpreadLayout);
})(cytoscape);