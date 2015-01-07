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
        while (DivNodes.length > cores)
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
        $$.Promise.all([// both threads done
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

                /*global Math */

// ---------------------------------------------------------------------------

                function Voronoi() {
                    this.vertices = null;
                    this.edges = null;
                    this.cells = null;
                    this.toRecycle = null;
                    this.beachsectionJunkyard = [];
                    this.circleEventJunkyard = [];
                    this.vertexJunkyard = [];
                    this.edgeJunkyard = [];
                    this.cellJunkyard = [];
                }

// ---------------------------------------------------------------------------

                Voronoi.prototype.reset = function () {
                    if (!this.beachline) {
                        this.beachline = new this.RBTree();
                    }
                    // Move leftover beachsections to the beachsection junkyard.
                    if (this.beachline.root) {
                        var beachsection = this.beachline.getFirst(this.beachline.root);
                        while (beachsection) {
                            this.beachsectionJunkyard.push(beachsection); // mark for reuse
                            beachsection = beachsection.rbNext;
                        }
                    }
                    this.beachline.root = null;
                    if (!this.circleEvents) {
                        this.circleEvents = new this.RBTree();
                    }
                    this.circleEvents.root = this.firstCircleEvent = null;
                    this.vertices = [];
                    this.edges = [];
                    this.cells = [];
                };

                Voronoi.prototype.sqrt = Math.sqrt;
                Voronoi.prototype.abs = Math.abs;
                Voronoi.prototype.ε = Voronoi.ε = 1e-9;
                Voronoi.prototype.invε = Voronoi.invε = 1.0 / Voronoi.ε;
                Voronoi.prototype.equalWithEpsilon = function (a, b) {
                    return this.abs(a - b) < 1e-9;
                };
                Voronoi.prototype.greaterThanWithEpsilon = function (a, b) {
                    return a - b > 1e-9;
                };
                Voronoi.prototype.greaterThanOrEqualWithEpsilon = function (a, b) {
                    return b - a < 1e-9;
                };
                Voronoi.prototype.lessThanWithEpsilon = function (a, b) {
                    return b - a > 1e-9;
                };
                Voronoi.prototype.lessThanOrEqualWithEpsilon = function (a, b) {
                    return a - b < 1e-9;
                };

// ---------------------------------------------------------------------------
// Red-Black tree code (based on C version of "rbtree" by Franck Bui-Huu
// https://github.com/fbuihuu/libtree/blob/master/rb.c

                Voronoi.prototype.RBTree = function () {
                    this.root = null;
                };

                Voronoi.prototype.RBTree.prototype.rbInsertSuccessor = function (node, successor) {
                    var parent;
                    if (node) {
                        // >>> rhill 2011-05-27: Performance: cache previous/next nodes
                        successor.rbPrevious = node;
                        successor.rbNext = node.rbNext;
                        if (node.rbNext) {
                            node.rbNext.rbPrevious = successor;
                        }
                        node.rbNext = successor;
                        // <<<
                        if (node.rbRight) {
                            // in-place expansion of node.rbRight.getFirst();
                            node = node.rbRight;
                            while (node.rbLeft) {
                                node = node.rbLeft;
                            }
                            node.rbLeft = successor;
                        }
                        else {
                            node.rbRight = successor;
                        }
                        parent = node;
                    }
                    // rhill 2011-06-07: if node is null, successor must be inserted
                    // to the left-most part of the tree
                    else if (this.root) {
                        node = this.getFirst(this.root);
                        // >>> Performance: cache previous/next nodes
                        successor.rbPrevious = null;
                        successor.rbNext = node;
                        node.rbPrevious = successor;
                        // <<<
                        node.rbLeft = successor;
                        parent = node;
                    }
                    else {
                        // >>> Performance: cache previous/next nodes
                        successor.rbPrevious = successor.rbNext = null;
                        // <<<
                        this.root = successor;
                        parent = null;
                    }
                    successor.rbLeft = successor.rbRight = null;
                    successor.rbParent = parent;
                    successor.rbRed = true;
                    // Fixup the modified tree by recoloring nodes and performing
                    // rotations (2 at most) hence the red-black tree properties are
                    // preserved.
                    var grandpa, uncle;
                    node = successor;
                    while (parent && parent.rbRed) {
                        grandpa = parent.rbParent;
                        if (parent === grandpa.rbLeft) {
                            uncle = grandpa.rbRight;
                            if (uncle && uncle.rbRed) {
                                parent.rbRed = uncle.rbRed = false;
                                grandpa.rbRed = true;
                                node = grandpa;
                            }
                            else {
                                if (node === parent.rbRight) {
                                    this.rbRotateLeft(parent);
                                    node = parent;
                                    parent = node.rbParent;
                                }
                                parent.rbRed = false;
                                grandpa.rbRed = true;
                                this.rbRotateRight(grandpa);
                            }
                        }
                        else {
                            uncle = grandpa.rbLeft;
                            if (uncle && uncle.rbRed) {
                                parent.rbRed = uncle.rbRed = false;
                                grandpa.rbRed = true;
                                node = grandpa;
                            }
                            else {
                                if (node === parent.rbLeft) {
                                    this.rbRotateRight(parent);
                                    node = parent;
                                    parent = node.rbParent;
                                }
                                parent.rbRed = false;
                                grandpa.rbRed = true;
                                this.rbRotateLeft(grandpa);
                            }
                        }
                        parent = node.rbParent;
                    }
                    this.root.rbRed = false;
                };

                Voronoi.prototype.RBTree.prototype.rbRemoveNode = function (node) {
                    // >>> rhill 2011-05-27: Performance: cache previous/next nodes
                    if (node.rbNext) {
                        node.rbNext.rbPrevious = node.rbPrevious;
                    }
                    if (node.rbPrevious) {
                        node.rbPrevious.rbNext = node.rbNext;
                    }
                    node.rbNext = node.rbPrevious = null;
                    // <<<
                    var parent = node.rbParent,
                            left = node.rbLeft,
                            right = node.rbRight,
                            next;
                    if (!left) {
                        next = right;
                    }
                    else if (!right) {
                        next = left;
                    }
                    else {
                        next = this.getFirst(right);
                    }
                    if (parent) {
                        if (parent.rbLeft === node) {
                            parent.rbLeft = next;
                        }
                        else {
                            parent.rbRight = next;
                        }
                    }
                    else {
                        this.root = next;
                    }
                    // enforce red-black rules
                    var isRed;
                    if (left && right) {
                        isRed = next.rbRed;
                        next.rbRed = node.rbRed;
                        next.rbLeft = left;
                        left.rbParent = next;
                        if (next !== right) {
                            parent = next.rbParent;
                            next.rbParent = node.rbParent;
                            node = next.rbRight;
                            parent.rbLeft = node;
                            next.rbRight = right;
                            right.rbParent = next;
                        }
                        else {
                            next.rbParent = parent;
                            parent = next;
                            node = next.rbRight;
                        }
                    }
                    else {
                        isRed = node.rbRed;
                        node = next;
                    }
                    // 'node' is now the sole successor's child and 'parent' its
                    // new parent (since the successor can have been moved)
                    if (node) {
                        node.rbParent = parent;
                    }
                    // the 'easy' cases
                    if (isRed) {
                        return;
                    }
                    if (node && node.rbRed) {
                        node.rbRed = false;
                        return;
                    }
                    // the other cases
                    var sibling;
                    do {
                        if (node === this.root) {
                            break;
                        }
                        if (node === parent.rbLeft) {
                            sibling = parent.rbRight;
                            if (sibling.rbRed) {
                                sibling.rbRed = false;
                                parent.rbRed = true;
                                this.rbRotateLeft(parent);
                                sibling = parent.rbRight;
                            }
                            if ((sibling.rbLeft && sibling.rbLeft.rbRed) || (sibling.rbRight && sibling.rbRight.rbRed)) {
                                if (!sibling.rbRight || !sibling.rbRight.rbRed) {
                                    sibling.rbLeft.rbRed = false;
                                    sibling.rbRed = true;
                                    this.rbRotateRight(sibling);
                                    sibling = parent.rbRight;
                                }
                                sibling.rbRed = parent.rbRed;
                                parent.rbRed = sibling.rbRight.rbRed = false;
                                this.rbRotateLeft(parent);
                                node = this.root;
                                break;
                            }
                        }
                        else {
                            sibling = parent.rbLeft;
                            if (sibling.rbRed) {
                                sibling.rbRed = false;
                                parent.rbRed = true;
                                this.rbRotateRight(parent);
                                sibling = parent.rbLeft;
                            }
                            if ((sibling.rbLeft && sibling.rbLeft.rbRed) || (sibling.rbRight && sibling.rbRight.rbRed)) {
                                if (!sibling.rbLeft || !sibling.rbLeft.rbRed) {
                                    sibling.rbRight.rbRed = false;
                                    sibling.rbRed = true;
                                    this.rbRotateLeft(sibling);
                                    sibling = parent.rbLeft;
                                }
                                sibling.rbRed = parent.rbRed;
                                parent.rbRed = sibling.rbLeft.rbRed = false;
                                this.rbRotateRight(parent);
                                node = this.root;
                                break;
                            }
                        }
                        sibling.rbRed = true;
                        node = parent;
                        parent = parent.rbParent;
                    } while (!node.rbRed);
                    if (node) {
                        node.rbRed = false;
                    }
                };

                Voronoi.prototype.RBTree.prototype.rbRotateLeft = function (node) {
                    var p = node,
                            q = node.rbRight, // can't be null
                            parent = p.rbParent;
                    if (parent) {
                        if (parent.rbLeft === p) {
                            parent.rbLeft = q;
                        }
                        else {
                            parent.rbRight = q;
                        }
                    }
                    else {
                        this.root = q;
                    }
                    q.rbParent = parent;
                    p.rbParent = q;
                    p.rbRight = q.rbLeft;
                    if (p.rbRight) {
                        p.rbRight.rbParent = p;
                    }
                    q.rbLeft = p;
                };

                Voronoi.prototype.RBTree.prototype.rbRotateRight = function (node) {
                    var p = node,
                            q = node.rbLeft, // can't be null
                            parent = p.rbParent;
                    if (parent) {
                        if (parent.rbLeft === p) {
                            parent.rbLeft = q;
                        }
                        else {
                            parent.rbRight = q;
                        }
                    }
                    else {
                        this.root = q;
                    }
                    q.rbParent = parent;
                    p.rbParent = q;
                    p.rbLeft = q.rbRight;
                    if (p.rbLeft) {
                        p.rbLeft.rbParent = p;
                    }
                    q.rbRight = p;
                };

                Voronoi.prototype.RBTree.prototype.getFirst = function (node) {
                    while (node.rbLeft) {
                        node = node.rbLeft;
                    }
                    return node;
                };

                Voronoi.prototype.RBTree.prototype.getLast = function (node) {
                    while (node.rbRight) {
                        node = node.rbRight;
                    }
                    return node;
                };

// ---------------------------------------------------------------------------
// Diagram methods

                Voronoi.prototype.Diagram = function (site) {
                    this.site = site;
                };

// ---------------------------------------------------------------------------
// Cell methods

                Voronoi.prototype.Cell = function (site) {
                    this.site = site;
                    this.halfedges = [];
                    this.closeMe = false;
                };

                Voronoi.prototype.Cell.prototype.init = function (site) {
                    this.site = site;
                    this.halfedges = [];
                    this.closeMe = false;
                    return this;
                };

                Voronoi.prototype.createCell = function (site) {
                    var cell = this.cellJunkyard.pop();
                    if (cell) {
                        return cell.init(site);
                    }
                    return new this.Cell(site);
                };

                Voronoi.prototype.Cell.prototype.prepareHalfedges = function () {
                    var halfedges = this.halfedges,
                            iHalfedge = halfedges.length,
                            edge;
                    // get rid of unused halfedges
                    // rhill 2011-05-27: Keep it simple, no point here in trying
                    // to be fancy: dangling edges are a typically a minority.
                    while (iHalfedge--) {
                        edge = halfedges[iHalfedge].edge;
                        if (!edge.vb || !edge.va) {
                            halfedges.splice(iHalfedge, 1);
                        }
                    }

                    // rhill 2011-05-26: I tried to use a binary search at insertion
                    // time to keep the array sorted on-the-fly (in Cell.addHalfedge()).
                    // There was no real benefits in doing so, performance on
                    // Firefox 3.6 was improved marginally, while performance on
                    // Opera 11 was penalized marginally.
                    halfedges.sort(function (a, b) {
                        return b.angle - a.angle;
                    });
                    return halfedges.length;
                };

// Return a list of the neighbor Ids
                Voronoi.prototype.Cell.prototype.getNeighborIds = function () {
                    var neighbors = [],
                            iHalfedge = this.halfedges.length,
                            edge;
                    while (iHalfedge--) {
                        edge = this.halfedges[iHalfedge].edge;
                        if (edge.lSite !== null && edge.lSite.voronoiId != this.site.voronoiId) {
                            neighbors.push(edge.lSite.voronoiId);
                        }
                        else if (edge.rSite !== null && edge.rSite.voronoiId != this.site.voronoiId) {
                            neighbors.push(edge.rSite.voronoiId);
                        }
                    }
                    return neighbors;
                };

// Compute bounding box
//
                Voronoi.prototype.Cell.prototype.getBbox = function () {
                    var halfedges = this.halfedges,
                            iHalfedge = halfedges.length,
                            xmin = Infinity,
                            ymin = Infinity,
                            xmax = -Infinity,
                            ymax = -Infinity,
                            v, vx, vy;
                    while (iHalfedge--) {
                        v = halfedges[iHalfedge].getStartpoint();
                        vx = v.x;
                        vy = v.y;
                        if (vx < xmin) {
                            xmin = vx;
                        }
                        if (vy < ymin) {
                            ymin = vy;
                        }
                        if (vx > xmax) {
                            xmax = vx;
                        }
                        if (vy > ymax) {
                            ymax = vy;
                        }
                        // we dont need to take into account end point,
                        // since each end point matches a start point
                    }
                    return {
                        x: xmin,
                        y: ymin,
                        width: xmax - xmin,
                        height: ymax - ymin
                    };
                };

// Return whether a point is inside, on, or outside the cell:
//   -1: point is outside the perimeter of the cell
//    0: point is on the perimeter of the cell
//    1: point is inside the perimeter of the cell
//
                Voronoi.prototype.Cell.prototype.pointIntersection = function (x, y) {
                    // Check if point in polygon. Since all polygons of a Voronoi
                    // diagram are convex, then:
                    // http://paulbourke.net/geometry/polygonmesh/
                    // Solution 3 (2D):
                    //   "If the polygon is convex then one can consider the polygon
                    //   "as a 'path' from the first vertex. A point is on the interior
                    //   "of this polygons if it is always on the same side of all the
                    //   "line segments making up the path. ...
                    //   "(y - y0) (x1 - x0) - (x - x0) (y1 - y0)
                    //   "if it is less than 0 then P is to the right of the line segment,
                    //   "if greater than 0 it is to the left, if equal to 0 then it lies
                    //   "on the line segment"
                    var halfedges = this.halfedges,
                            iHalfedge = halfedges.length,
                            halfedge,
                            p0, p1, r;
                    while (iHalfedge--) {
                        halfedge = halfedges[iHalfedge];
                        p0 = halfedge.getStartpoint();
                        p1 = halfedge.getEndpoint();
                        r = (y - p0.y) * (p1.x - p0.x) - (x - p0.x) * (p1.y - p0.y);
                        if (!r) {
                            return 0;
                        }
                        if (r > 0) {
                            return -1;
                        }
                    }
                    return 1;
                };

// ---------------------------------------------------------------------------
// Edge methods
//

                Voronoi.prototype.Vertex = function (x, y) {
                    this.x = x;
                    this.y = y;
                };

                Voronoi.prototype.Edge = function (lSite, rSite) {
                    this.lSite = lSite;
                    this.rSite = rSite;
                    this.va = this.vb = null;
                };

                Voronoi.prototype.Halfedge = function (edge, lSite, rSite) {
                    this.site = lSite;
                    this.edge = edge;
                    // 'angle' is a value to be used for properly sorting the
                    // halfsegments counterclockwise. By convention, we will
                    // use the angle of the line defined by the 'site to the left'
                    // to the 'site to the right'.
                    // However, border edges have no 'site to the right': thus we
                    // use the angle of line perpendicular to the halfsegment (the
                    // edge should have both end points defined in such case.)
                    if (rSite) {
                        this.angle = Math.atan2(rSite.y - lSite.y, rSite.x - lSite.x);
                    }
                    else {
                        var va = edge.va,
                                vb = edge.vb;
                        // rhill 2011-05-31: used to call getStartpoint()/getEndpoint(),
                        // but for performance purpose, these are expanded in place here.
                        this.angle = edge.lSite === lSite ?
                                Math.atan2(vb.x - va.x, va.y - vb.y) :
                                Math.atan2(va.x - vb.x, vb.y - va.y);
                    }
                };

                Voronoi.prototype.createHalfedge = function (edge, lSite, rSite) {
                    return new this.Halfedge(edge, lSite, rSite);
                };

                Voronoi.prototype.Halfedge.prototype.getStartpoint = function () {
                    return this.edge.lSite === this.site ? this.edge.va : this.edge.vb;
                };

                Voronoi.prototype.Halfedge.prototype.getEndpoint = function () {
                    return this.edge.lSite === this.site ? this.edge.vb : this.edge.va;
                };



// this create and add a vertex to the internal collection

                Voronoi.prototype.createVertex = function (x, y) {
                    var v = this.vertexJunkyard.pop();
                    if (!v) {
                        v = new this.Vertex(x, y);
                    }
                    else {
                        v.x = x;
                        v.y = y;
                    }
                    this.vertices.push(v);
                    return v;
                };

// this create and add an edge to internal collection, and also create
// two halfedges which are added to each site's counterclockwise array
// of halfedges.

                Voronoi.prototype.createEdge = function (lSite, rSite, va, vb) {
                    var edge = this.edgeJunkyard.pop();
                    if (!edge) {
                        edge = new this.Edge(lSite, rSite);
                    }
                    else {
                        edge.lSite = lSite;
                        edge.rSite = rSite;
                        edge.va = edge.vb = null;
                    }

                    this.edges.push(edge);
                    if (va) {
                        this.setEdgeStartpoint(edge, lSite, rSite, va);
                    }
                    if (vb) {
                        this.setEdgeEndpoint(edge, lSite, rSite, vb);
                    }
                    this.cells[lSite.voronoiId].halfedges.push(this.createHalfedge(edge, lSite, rSite));
                    this.cells[rSite.voronoiId].halfedges.push(this.createHalfedge(edge, rSite, lSite));
                    return edge;
                };

                Voronoi.prototype.createBorderEdge = function (lSite, va, vb) {
                    var edge = this.edgeJunkyard.pop();
                    if (!edge) {
                        edge = new this.Edge(lSite, null);
                    }
                    else {
                        edge.lSite = lSite;
                        edge.rSite = null;
                    }
                    edge.va = va;
                    edge.vb = vb;
                    this.edges.push(edge);
                    return edge;
                };

                Voronoi.prototype.setEdgeStartpoint = function (edge, lSite, rSite, vertex) {
                    if (!edge.va && !edge.vb) {
                        edge.va = vertex;
                        edge.lSite = lSite;
                        edge.rSite = rSite;
                    }
                    else if (edge.lSite === rSite) {
                        edge.vb = vertex;
                    }
                    else {
                        edge.va = vertex;
                    }
                };

                Voronoi.prototype.setEdgeEndpoint = function (edge, lSite, rSite, vertex) {
                    this.setEdgeStartpoint(edge, rSite, lSite, vertex);
                };

// ---------------------------------------------------------------------------
// Beachline methods

// rhill 2011-06-07: For some reasons, performance suffers significantly
// when instanciating a literal object instead of an empty ctor
                Voronoi.prototype.Beachsection = function () {
                };

// rhill 2011-06-02: A lot of Beachsection instanciations
// occur during the computation of the Voronoi diagram,
// somewhere between the number of sites and twice the
// number of sites, while the number of Beachsections on the
// beachline at any given time is comparatively low. For this
// reason, we reuse already created Beachsections, in order
// to avoid new memory allocation. This resulted in a measurable
// performance gain.

                Voronoi.prototype.createBeachsection = function (site) {
                    var beachsection = this.beachsectionJunkyard.pop();
                    if (!beachsection) {
                        beachsection = new this.Beachsection();
                    }
                    beachsection.site = site;
                    return beachsection;
                };

// calculate the left break point of a particular beach section,
// given a particular sweep line
                Voronoi.prototype.leftBreakPoint = function (arc, directrix) {
                    // http://en.wikipedia.org/wiki/Parabola
                    // http://en.wikipedia.org/wiki/Quadratic_equation
                    // h1 = x1,
                    // k1 = (y1+directrix)/2,
                    // h2 = x2,
                    // k2 = (y2+directrix)/2,
                    // p1 = k1-directrix,
                    // a1 = 1/(4*p1),
                    // b1 = -h1/(2*p1),
                    // c1 = h1*h1/(4*p1)+k1,
                    // p2 = k2-directrix,
                    // a2 = 1/(4*p2),
                    // b2 = -h2/(2*p2),
                    // c2 = h2*h2/(4*p2)+k2,
                    // x = (-(b2-b1) + Math.sqrt((b2-b1)*(b2-b1) - 4*(a2-a1)*(c2-c1))) / (2*(a2-a1))
                    // When x1 become the x-origin:
                    // h1 = 0,
                    // k1 = (y1+directrix)/2,
                    // h2 = x2-x1,
                    // k2 = (y2+directrix)/2,
                    // p1 = k1-directrix,
                    // a1 = 1/(4*p1),
                    // b1 = 0,
                    // c1 = k1,
                    // p2 = k2-directrix,
                    // a2 = 1/(4*p2),
                    // b2 = -h2/(2*p2),
                    // c2 = h2*h2/(4*p2)+k2,
                    // x = (-b2 + Math.sqrt(b2*b2 - 4*(a2-a1)*(c2-k1))) / (2*(a2-a1)) + x1

                    // change code below at your own risk: care has been taken to
                    // reduce errors due to computers' finite arithmetic precision.
                    // Maybe can still be improved, will see if any more of this
                    // kind of errors pop up again.
                    var site = arc.site,
                            rfocx = site.x,
                            rfocy = site.y,
                            pby2 = rfocy - directrix;
                    // parabola in degenerate case where focus is on directrix
                    if (!pby2) {
                        return rfocx;
                    }
                    var lArc = arc.rbPrevious;
                    if (!lArc) {
                        return -Infinity;
                    }
                    site = lArc.site;
                    var lfocx = site.x,
                            lfocy = site.y,
                            plby2 = lfocy - directrix;
                    // parabola in degenerate case where focus is on directrix
                    if (!plby2) {
                        return lfocx;
                    }
                    var hl = lfocx - rfocx,
                            aby2 = 1 / pby2 - 1 / plby2,
                            b = hl / plby2;
                    if (aby2) {
                        return (-b + this.sqrt(b * b - 2 * aby2 * (hl * hl / (-2 * plby2) - lfocy + plby2 / 2 + rfocy - pby2 / 2))) / aby2 + rfocx;
                    }
                    // both parabolas have same distance to directrix, thus break point is midway
                    return (rfocx + lfocx) / 2;
                };

// calculate the right break point of a particular beach section,
// given a particular directrix
                Voronoi.prototype.rightBreakPoint = function (arc, directrix) {
                    var rArc = arc.rbNext;
                    if (rArc) {
                        return this.leftBreakPoint(rArc, directrix);
                    }
                    var site = arc.site;
                    return site.y === directrix ? site.x : Infinity;
                };

                Voronoi.prototype.detachBeachsection = function (beachsection) {
                    this.detachCircleEvent(beachsection); // detach potentially attached circle event
                    this.beachline.rbRemoveNode(beachsection); // remove from RB-tree
                    this.beachsectionJunkyard.push(beachsection); // mark for reuse
                };

                Voronoi.prototype.removeBeachsection = function (beachsection) {
                    var circle = beachsection.circleEvent,
                            x = circle.x,
                            y = circle.ycenter,
                            vertex = this.createVertex(x, y),
                            previous = beachsection.rbPrevious,
                            next = beachsection.rbNext,
                            disappearingTransitions = [beachsection],
                            abs_fn = Math.abs;

                    // remove collapsed beachsection from beachline
                    this.detachBeachsection(beachsection);

                    // there could be more than one empty arc at the deletion point, this
                    // happens when more than two edges are linked by the same vertex,
                    // so we will collect all those edges by looking up both sides of
                    // the deletion point.
                    // by the way, there is *always* a predecessor/successor to any collapsed
                    // beach section, it's just impossible to have a collapsing first/last
                    // beach sections on the beachline, since they obviously are unconstrained
                    // on their left/right side.

                    // look left
                    var lArc = previous;
                    while (lArc.circleEvent && abs_fn(x - lArc.circleEvent.x) < 1e-9 && abs_fn(y - lArc.circleEvent.ycenter) < 1e-9) {
                        previous = lArc.rbPrevious;
                        disappearingTransitions.unshift(lArc);
                        this.detachBeachsection(lArc); // mark for reuse
                        lArc = previous;
                    }
                    // even though it is not disappearing, I will also add the beach section
                    // immediately to the left of the left-most collapsed beach section, for
                    // convenience, since we need to refer to it later as this beach section
                    // is the 'left' site of an edge for which a start point is set.
                    disappearingTransitions.unshift(lArc);
                    this.detachCircleEvent(lArc);

                    // look right
                    var rArc = next;
                    while (rArc.circleEvent && abs_fn(x - rArc.circleEvent.x) < 1e-9 && abs_fn(y - rArc.circleEvent.ycenter) < 1e-9) {
                        next = rArc.rbNext;
                        disappearingTransitions.push(rArc);
                        this.detachBeachsection(rArc); // mark for reuse
                        rArc = next;
                    }
                    // we also have to add the beach section immediately to the right of the
                    // right-most collapsed beach section, since there is also a disappearing
                    // transition representing an edge's start point on its left.
                    disappearingTransitions.push(rArc);
                    this.detachCircleEvent(rArc);

                    // walk through all the disappearing transitions between beach sections and
                    // set the start point of their (implied) edge.
                    var nArcs = disappearingTransitions.length,
                            iArc;
                    for (iArc = 1; iArc < nArcs; iArc++) {
                        rArc = disappearingTransitions[iArc];
                        lArc = disappearingTransitions[iArc - 1];
                        this.setEdgeStartpoint(rArc.edge, lArc.site, rArc.site, vertex);
                    }

                    // create a new edge as we have now a new transition between
                    // two beach sections which were previously not adjacent.
                    // since this edge appears as a new vertex is defined, the vertex
                    // actually define an end point of the edge (relative to the site
                    // on the left)
                    lArc = disappearingTransitions[0];
                    rArc = disappearingTransitions[nArcs - 1];
                    rArc.edge = this.createEdge(lArc.site, rArc.site, undefined, vertex);

                    // create circle events if any for beach sections left in the beachline
                    // adjacent to collapsed sections
                    this.attachCircleEvent(lArc);
                    this.attachCircleEvent(rArc);
                };

                Voronoi.prototype.addBeachsection = function (site) {
                    var x = site.x,
                            directrix = site.y;

                    // find the left and right beach sections which will surround the newly
                    // created beach section.
                    // rhill 2011-06-01: This loop is one of the most often executed,
                    // hence we expand in-place the comparison-against-epsilon calls.
                    var lArc, rArc,
                            dxl, dxr,
                            node = this.beachline.root;

                    while (node) {
                        dxl = this.leftBreakPoint(node, directrix) - x;
                        // x lessThanWithEpsilon xl => falls somewhere before the left edge of the beachsection
                        if (dxl > 1e-9) {
                            // this case should never happen
                            // if (!node.rbLeft) {
                            //    rArc = node.rbLeft;
                            //    break;
                            //    }
                            node = node.rbLeft;
                        }
                        else {
                            dxr = x - this.rightBreakPoint(node, directrix);
                            // x greaterThanWithEpsilon xr => falls somewhere after the right edge of the beachsection
                            if (dxr > 1e-9) {
                                if (!node.rbRight) {
                                    lArc = node;
                                    break;
                                }
                                node = node.rbRight;
                            }
                            else {
                                // x equalWithEpsilon xl => falls exactly on the left edge of the beachsection
                                if (dxl > -1e-9) {
                                    lArc = node.rbPrevious;
                                    rArc = node;
                                }
                                // x equalWithEpsilon xr => falls exactly on the right edge of the beachsection
                                else if (dxr > -1e-9) {
                                    lArc = node;
                                    rArc = node.rbNext;
                                }
                                // falls exactly somewhere in the middle of the beachsection
                                else {
                                    lArc = rArc = node;
                                }
                                break;
                            }
                        }
                    }
                    // at this point, keep in mind that lArc and/or rArc could be
                    // undefined or null.

                    // create a new beach section object for the site and add it to RB-tree
                    var newArc = this.createBeachsection(site);
                    this.beachline.rbInsertSuccessor(lArc, newArc);

                    // cases:
                    //

                    // [null,null]
                    // least likely case: new beach section is the first beach section on the
                    // beachline.
                    // This case means:
                    //   no new transition appears
                    //   no collapsing beach section
                    //   new beachsection become root of the RB-tree
                    if (!lArc && !rArc) {
                        return;
                    }

                    // [lArc,rArc] where lArc == rArc
                    // most likely case: new beach section split an existing beach
                    // section.
                    // This case means:
                    //   one new transition appears
                    //   the left and right beach section might be collapsing as a result
                    //   two new nodes added to the RB-tree
                    if (lArc === rArc) {
                        // invalidate circle event of split beach section
                        this.detachCircleEvent(lArc);

                        // split the beach section into two separate beach sections
                        rArc = this.createBeachsection(lArc.site);
                        this.beachline.rbInsertSuccessor(newArc, rArc);

                        // since we have a new transition between two beach sections,
                        // a new edge is born
                        newArc.edge = rArc.edge = this.createEdge(lArc.site, newArc.site);

                        // check whether the left and right beach sections are collapsing
                        // and if so create circle events, to be notified when the point of
                        // collapse is reached.
                        this.attachCircleEvent(lArc);
                        this.attachCircleEvent(rArc);
                        return;
                    }

                    // [lArc,null]
                    // even less likely case: new beach section is the *last* beach section
                    // on the beachline -- this can happen *only* if *all* the previous beach
                    // sections currently on the beachline share the same y value as
                    // the new beach section.
                    // This case means:
                    //   one new transition appears
                    //   no collapsing beach section as a result
                    //   new beach section become right-most node of the RB-tree
                    if (lArc && !rArc) {
                        newArc.edge = this.createEdge(lArc.site, newArc.site);
                        return;
                    }

                    // [null,rArc]
                    // impossible case: because sites are strictly processed from top to bottom,
                    // and left to right, which guarantees that there will always be a beach section
                    // on the left -- except of course when there are no beach section at all on
                    // the beach line, which case was handled above.
                    // rhill 2011-06-02: No point testing in non-debug version
                    //if (!lArc && rArc) {
                    //    throw "Voronoi.addBeachsection(): What is this I don't even";
                    //    }

                    // [lArc,rArc] where lArc != rArc
                    // somewhat less likely case: new beach section falls *exactly* in between two
                    // existing beach sections
                    // This case means:
                    //   one transition disappears
                    //   two new transitions appear
                    //   the left and right beach section might be collapsing as a result
                    //   only one new node added to the RB-tree
                    if (lArc !== rArc) {
                        // invalidate circle events of left and right sites
                        this.detachCircleEvent(lArc);
                        this.detachCircleEvent(rArc);

                        // an existing transition disappears, meaning a vertex is defined at
                        // the disappearance point.
                        // since the disappearance is caused by the new beachsection, the
                        // vertex is at the center of the circumscribed circle of the left,
                        // new and right beachsections.
                        // http://mathforum.org/library/drmath/view/55002.html
                        // Except that I bring the origin at A to simplify
                        // calculation
                        var lSite = lArc.site,
                                ax = lSite.x,
                                ay = lSite.y,
                                bx = site.x - ax,
                                by = site.y - ay,
                                rSite = rArc.site,
                                cx = rSite.x - ax,
                                cy = rSite.y - ay,
                                d = 2 * (bx * cy - by * cx),
                                hb = bx * bx + by * by,
                                hc = cx * cx + cy * cy,
                                vertex = this.createVertex((cy * hb - by * hc) / d + ax, (bx * hc - cx * hb) / d + ay);

                        // one transition disappear
                        this.setEdgeStartpoint(rArc.edge, lSite, rSite, vertex);

                        // two new transitions appear at the new vertex location
                        newArc.edge = this.createEdge(lSite, site, undefined, vertex);
                        rArc.edge = this.createEdge(site, rSite, undefined, vertex);

                        // check whether the left and right beach sections are collapsing
                        // and if so create circle events, to handle the point of collapse.
                        this.attachCircleEvent(lArc);
                        this.attachCircleEvent(rArc);
                        return;
                    }
                };

// ---------------------------------------------------------------------------
// Circle event methods

// rhill 2011-06-07: For some reasons, performance suffers significantly
// when instanciating a literal object instead of an empty ctor
                Voronoi.prototype.CircleEvent = function () {
                    // rhill 2013-10-12: it helps to state exactly what we are at ctor time.
                    this.arc = null;
                    this.rbLeft = null;
                    this.rbNext = null;
                    this.rbParent = null;
                    this.rbPrevious = null;
                    this.rbRed = false;
                    this.rbRight = null;
                    this.site = null;
                    this.x = this.y = this.ycenter = 0;
                };

                Voronoi.prototype.attachCircleEvent = function (arc) {
                    var lArc = arc.rbPrevious,
                            rArc = arc.rbNext;
                    if (!lArc || !rArc) {
                        return;
                    } // does that ever happen?
                    var lSite = lArc.site,
                            cSite = arc.site,
                            rSite = rArc.site;

                    // If site of left beachsection is same as site of
                    // right beachsection, there can't be convergence
                    if (lSite === rSite) {
                        return;
                    }

                    // Find the circumscribed circle for the three sites associated
                    // with the beachsection triplet.
                    // rhill 2011-05-26: It is more efficient to calculate in-place
                    // rather than getting the resulting circumscribed circle from an
                    // object returned by calling Voronoi.circumcircle()
                    // http://mathforum.org/library/drmath/view/55002.html
                    // Except that I bring the origin at cSite to simplify calculations.
                    // The bottom-most part of the circumcircle is our Fortune 'circle
                    // event', and its center is a vertex potentially part of the final
                    // Voronoi diagram.
                    var bx = cSite.x,
                            by = cSite.y,
                            ax = lSite.x - bx,
                            ay = lSite.y - by,
                            cx = rSite.x - bx,
                            cy = rSite.y - by;

                    // If points l->c->r are clockwise, then center beach section does not
                    // collapse, hence it can't end up as a vertex (we reuse 'd' here, which
                    // sign is reverse of the orientation, hence we reverse the test.
                    // http://en.wikipedia.org/wiki/Curve_orientation#Orientation_of_a_simple_polygon
                    // rhill 2011-05-21: Nasty finite precision error which caused circumcircle() to
                    // return infinites: 1e-12 seems to fix the problem.
                    var d = 2 * (ax * cy - ay * cx);
                    if (d >= -2e-12) {
                        return;
                    }

                    var ha = ax * ax + ay * ay,
                            hc = cx * cx + cy * cy,
                            x = (cy * ha - ay * hc) / d,
                            y = (ax * hc - cx * ha) / d,
                            ycenter = y + by;

                    // Important: ybottom should always be under or at sweep, so no need
                    // to waste CPU cycles by checking

                    // recycle circle event object if possible
                    var circleEvent = this.circleEventJunkyard.pop();
                    if (!circleEvent) {
                        circleEvent = new this.CircleEvent();
                    }
                    circleEvent.arc = arc;
                    circleEvent.site = cSite;
                    circleEvent.x = x + bx;
                    circleEvent.y = ycenter + this.sqrt(x * x + y * y); // y bottom
                    circleEvent.ycenter = ycenter;
                    arc.circleEvent = circleEvent;

                    // find insertion point in RB-tree: circle events are ordered from
                    // smallest to largest
                    var predecessor = null,
                            node = this.circleEvents.root;
                    while (node) {
                        if (circleEvent.y < node.y || (circleEvent.y === node.y && circleEvent.x <= node.x)) {
                            if (node.rbLeft) {
                                node = node.rbLeft;
                            }
                            else {
                                predecessor = node.rbPrevious;
                                break;
                            }
                        }
                        else {
                            if (node.rbRight) {
                                node = node.rbRight;
                            }
                            else {
                                predecessor = node;
                                break;
                            }
                        }
                    }
                    this.circleEvents.rbInsertSuccessor(predecessor, circleEvent);
                    if (!predecessor) {
                        this.firstCircleEvent = circleEvent;
                    }
                };

                Voronoi.prototype.detachCircleEvent = function (arc) {
                    var circleEvent = arc.circleEvent;
                    if (circleEvent) {
                        if (!circleEvent.rbPrevious) {
                            this.firstCircleEvent = circleEvent.rbNext;
                        }
                        this.circleEvents.rbRemoveNode(circleEvent); // remove from RB-tree
                        this.circleEventJunkyard.push(circleEvent);
                        arc.circleEvent = null;
                    }
                };

// ---------------------------------------------------------------------------
// Diagram completion methods

// connect dangling edges (not if a cursory test tells us
// it is not going to be visible.
// return value:
//   false: the dangling endpoint couldn't be connected
//   true: the dangling endpoint could be connected
                Voronoi.prototype.connectEdge = function (edge, bbox) {
                    // skip if end point already connected
                    var vb = edge.vb;
                    if (!!vb) {
                        return true;
                    }

                    // make local copy for performance purpose
                    var va = edge.va,
                            xl = bbox.xl,
                            xr = bbox.xr,
                            yt = bbox.yt,
                            yb = bbox.yb,
                            lSite = edge.lSite,
                            rSite = edge.rSite,
                            lx = lSite.x,
                            ly = lSite.y,
                            rx = rSite.x,
                            ry = rSite.y,
                            fx = (lx + rx) / 2,
                            fy = (ly + ry) / 2,
                            fm, fb;

                    // if we reach here, this means cells which use this edge will need
                    // to be closed, whether because the edge was removed, or because it
                    // was connected to the bounding box.
                    this.cells[lSite.voronoiId].closeMe = true;
                    this.cells[rSite.voronoiId].closeMe = true;

                    // get the line equation of the bisector if line is not vertical
                    if (ry !== ly) {
                        fm = (lx - rx) / (ry - ly);
                        fb = fy - fm * fx;
                    }

                    // remember, direction of line (relative to left site):
                    // upward: left.x < right.x
                    // downward: left.x > right.x
                    // horizontal: left.x == right.x
                    // upward: left.x < right.x
                    // rightward: left.y < right.y
                    // leftward: left.y > right.y
                    // vertical: left.y == right.y

                    // depending on the direction, find the best side of the
                    // bounding box to use to determine a reasonable start point

                    // rhill 2013-12-02:
                    // While at it, since we have the values which define the line,
                    // clip the end of va if it is outside the bbox.
                    // https://github.com/gorhill/Javascript-Voronoi/issues/15
                    // TODO: Do all the clipping here rather than rely on Liang-Barsky
                    // which does not do well sometimes due to loss of arithmetic
                    // precision. The code here doesn't degrade if one of the vertex is
                    // at a huge distance.

                    // special case: vertical line
                    if (fm === undefined) {
                        // doesn't intersect with viewport
                        if (fx < xl || fx >= xr) {
                            return false;
                        }
                        // downward
                        if (lx > rx) {
                            if (!va || va.y < yt) {
                                va = this.createVertex(fx, yt);
                            }
                            else if (va.y >= yb) {
                                return false;
                            }
                            vb = this.createVertex(fx, yb);
                        }
                        // upward
                        else {
                            if (!va || va.y > yb) {
                                va = this.createVertex(fx, yb);
                            }
                            else if (va.y < yt) {
                                return false;
                            }
                            vb = this.createVertex(fx, yt);
                        }
                    }
                    // closer to vertical than horizontal, connect start point to the
                    // top or bottom side of the bounding box
                    else if (fm < -1 || fm > 1) {
                        // downward
                        if (lx > rx) {
                            if (!va || va.y < yt) {
                                va = this.createVertex((yt - fb) / fm, yt);
                            }
                            else if (va.y >= yb) {
                                return false;
                            }
                            vb = this.createVertex((yb - fb) / fm, yb);
                        }
                        // upward
                        else {
                            if (!va || va.y > yb) {
                                va = this.createVertex((yb - fb) / fm, yb);
                            }
                            else if (va.y < yt) {
                                return false;
                            }
                            vb = this.createVertex((yt - fb) / fm, yt);
                        }
                    }
                    // closer to horizontal than vertical, connect start point to the
                    // left or right side of the bounding box
                    else {
                        // rightward
                        if (ly < ry) {
                            if (!va || va.x < xl) {
                                va = this.createVertex(xl, fm * xl + fb);
                            }
                            else if (va.x >= xr) {
                                return false;
                            }
                            vb = this.createVertex(xr, fm * xr + fb);
                        }
                        // leftward
                        else {
                            if (!va || va.x > xr) {
                                va = this.createVertex(xr, fm * xr + fb);
                            }
                            else if (va.x < xl) {
                                return false;
                            }
                            vb = this.createVertex(xl, fm * xl + fb);
                        }
                    }
                    edge.va = va;
                    edge.vb = vb;

                    return true;
                };

// line-clipping code taken from:
//   Liang-Barsky function by Daniel White
//   http://www.skytopia.com/project/articles/compsci/clipping.html
// Thanks!
// A bit modified to minimize code paths
                Voronoi.prototype.clipEdge = function (edge, bbox) {
                    var ax = edge.va.x,
                            ay = edge.va.y,
                            bx = edge.vb.x,
                            by = edge.vb.y,
                            t0 = 0,
                            t1 = 1,
                            dx = bx - ax,
                            dy = by - ay;
                    // left
                    var q = ax - bbox.xl;
                    if (dx === 0 && q < 0) {
                        return false;
                    }
                    var r = -q / dx;
                    if (dx < 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }
                    else if (dx > 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    // right
                    q = bbox.xr - ax;
                    if (dx === 0 && q < 0) {
                        return false;
                    }
                    r = q / dx;
                    if (dx < 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    else if (dx > 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }
                    // top
                    q = ay - bbox.yt;
                    if (dy === 0 && q < 0) {
                        return false;
                    }
                    r = -q / dy;
                    if (dy < 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }
                    else if (dy > 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    // bottom        
                    q = bbox.yb - ay;
                    if (dy === 0 && q < 0) {
                        return false;
                    }
                    r = q / dy;
                    if (dy < 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    else if (dy > 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }

                    // if we reach this point, Voronoi edge is within bbox

                    // if t0 > 0, va needs to change
                    // rhill 2011-06-03: we need to create a new vertex rather
                    // than modifying the existing one, since the existing
                    // one is likely shared with at least another edge
                    if (t0 > 0) {
                        edge.va = this.createVertex(ax + t0 * dx, ay + t0 * dy);
                    }

                    // if t1 < 1, vb needs to change
                    // rhill 2011-06-03: we need to create a new vertex rather
                    // than modifying the existing one, since the existing
                    // one is likely shared with at least another edge
                    if (t1 < 1) {
                        edge.vb = this.createVertex(ax + t1 * dx, ay + t1 * dy);
                    }

                    // va and/or vb were clipped, thus we will need to close
                    // cells which use this edge.
                    if (t0 > 0 || t1 < 1) {
                        this.cells[edge.lSite.voronoiId].closeMe = true;
                        this.cells[edge.rSite.voronoiId].closeMe = true;
                    }

                    return true;
                };

// Connect/cut edges at bounding box
                Voronoi.prototype.clipEdges = function (bbox) {
                    // connect all dangling edges to bounding box
                    // or get rid of them if it can't be done
                    var edges = this.edges,
                            iEdge = edges.length,
                            edge,
                            abs_fn = Math.abs;

                    // iterate backward so we can splice safely
                    while (iEdge--) {
                        edge = edges[iEdge];
                        // edge is removed if:
                        //   it is wholly outside the bounding box
                        //   it is looking more like a point than a line
                        if (!this.connectEdge(edge, bbox) ||
                                !this.clipEdge(edge, bbox) ||
                                (abs_fn(edge.va.x - edge.vb.x) < 1e-9 && abs_fn(edge.va.y - edge.vb.y) < 1e-9)) {
                            edge.va = edge.vb = null;
                            edges.splice(iEdge, 1);
                        }
                    }
                };

// Close the cells.
// The cells are bound by the supplied bounding box.
// Each cell refers to its associated site, and a list
// of halfedges ordered counterclockwise.
                Voronoi.prototype.closeCells = function (bbox) {
                    var xl = bbox.xl,
                            xr = bbox.xr,
                            yt = bbox.yt,
                            yb = bbox.yb,
                            cells = this.cells,
                            iCell = cells.length,
                            cell,
                            iLeft,
                            halfedges, nHalfedges,
                            edge,
                            va, vb, vz,
                            lastBorderSegment,
                            abs_fn = Math.abs;

                    while (iCell--) {
                        cell = cells[iCell];
                        // prune, order halfedges counterclockwise, then add missing ones
                        // required to close cells
                        if (!cell.prepareHalfedges()) {
                            continue;
                        }
                        if (!cell.closeMe) {
                            continue;
                        }
                        // find first 'unclosed' point.
                        // an 'unclosed' point will be the end point of a halfedge which
                        // does not match the start point of the following halfedge
                        halfedges = cell.halfedges;
                        nHalfedges = halfedges.length;
                        // special case: only one site, in which case, the viewport is the cell
                        // ...

                        // all other cases
                        iLeft = 0;
                        while (iLeft < nHalfedges) {
                            va = halfedges[iLeft].getEndpoint();
                            vz = halfedges[(iLeft + 1) % nHalfedges].getStartpoint();
                            // if end point is not equal to start point, we need to add the missing
                            // halfedge(s) up to vz
                            if (abs_fn(va.x - vz.x) >= 1e-9 || abs_fn(va.y - vz.y) >= 1e-9) {

                                // rhill 2013-12-02:
                                // "Holes" in the halfedges are not necessarily always adjacent.
                                // https://github.com/gorhill/Javascript-Voronoi/issues/16

                                // find entry point:
                                switch (true) {

                                    // walk downward along left side
                                    case this.equalWithEpsilon(va.x, xl) && this.lessThanWithEpsilon(va.y, yb):
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xl);
                                        vb = this.createVertex(xl, lastBorderSegment ? vz.y : yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk rightward along bottom side
                                    case this.equalWithEpsilon(va.y, yb) && this.lessThanWithEpsilon(va.x, xr):
                                        lastBorderSegment = this.equalWithEpsilon(vz.y, yb);
                                        vb = this.createVertex(lastBorderSegment ? vz.x : xr, yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk upward along right side
                                    case this.equalWithEpsilon(va.x, xr) && this.greaterThanWithEpsilon(va.y, yt):
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xr);
                                        vb = this.createVertex(xr, lastBorderSegment ? vz.y : yt);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk leftward along top side
                                    case this.equalWithEpsilon(va.y, yt) && this.greaterThanWithEpsilon(va.x, xl):
                                        lastBorderSegment = this.equalWithEpsilon(vz.y, yt);
                                        vb = this.createVertex(lastBorderSegment ? vz.x : xl, yt);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk downward along left side
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xl);
                                        vb = this.createVertex(xl, lastBorderSegment ? vz.y : yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk rightward along bottom side
                                        lastBorderSegment = this.equalWithEpsilon(vz.y, yb);
                                        vb = this.createVertex(lastBorderSegment ? vz.x : xr, yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk upward along right side
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xr);
                                        vb = this.createVertex(xr, lastBorderSegment ? vz.y : yt);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        // fall through

                                    default:
                                        throw "Voronoi.closeCells() > this makes no sense!";
                                }
                            }
                            iLeft++;
                        }
                        cell.closeMe = false;
                    }
                };

// ---------------------------------------------------------------------------
// Debugging helper
                /*
                 Voronoi.prototype.dumpBeachline = function(y) {
                 console.log('Voronoi.dumpBeachline(%f) > Beachsections, from left to right:', y);
                 if ( !this.beachline ) {
                 console.log('  None');
                 }
                 else {
                 var bs = this.beachline.getFirst(this.beachline.root);
                 while ( bs ) {
                 console.log('  site %d: xl: %f, xr: %f', bs.site.voronoiId, this.leftBreakPoint(bs, y), this.rightBreakPoint(bs, y));
                 bs = bs.rbNext;
                 }
                 }
                 };
                 */

// ---------------------------------------------------------------------------
// Helper: Quantize sites

// rhill 2013-10-12:
// This is to solve https://github.com/gorhill/Javascript-Voronoi/issues/15
// Since not all users will end up using the kind of coord values which would
// cause the issue to arise, I chose to let the user decide whether or not
// he should sanitize his coord values through this helper. This way, for
// those users who uses coord values which are known to be fine, no overhead is
// added.

                Voronoi.prototype.quantizeSites = function (sites) {
                    var ε = this.ε,
                            n = sites.length,
                            site;
                    while (n--) {
                        site = sites[n];
                        site.x = Math.floor(site.x / ε) * ε;
                        site.y = Math.floor(site.y / ε) * ε;
                    }
                };

// ---------------------------------------------------------------------------
// Helper: Recycle diagram: all vertex, edge and cell objects are
// "surrendered" to the Voronoi object for reuse.
// TODO: rhill-voronoi-core v2: more performance to be gained
// when I change the semantic of what is returned.

                Voronoi.prototype.recycle = function (diagram) {
                    if (diagram) {
                        if (diagram instanceof this.Diagram) {
                            this.toRecycle = diagram;
                        }
                        else {
                            throw 'Voronoi.recycleDiagram() > Need a Diagram object.';
                        }
                    }
                };

// ---------------------------------------------------------------------------
// Top-level Fortune loop

// rhill 2011-05-19:
//   Voronoi sites are kept client-side now, to allow
//   user to freely modify content. At compute time,
//   *references* to sites are copied locally.

                Voronoi.prototype.compute = function (sites, bbox) {
                    // to measure execution time
                    var startTime = new Date();

                    // init internal state
                    this.reset();

                    // any diagram data available for recycling?
                    // I do that here so that this is included in execution time
                    if (this.toRecycle) {
                        this.vertexJunkyard = this.vertexJunkyard.concat(this.toRecycle.vertices);
                        this.edgeJunkyard = this.edgeJunkyard.concat(this.toRecycle.edges);
                        this.cellJunkyard = this.cellJunkyard.concat(this.toRecycle.cells);
                        this.toRecycle = null;
                    }

                    // Initialize site event queue
                    var siteEvents = sites.slice(0);
                    siteEvents.sort(function (a, b) {
                        var r = b.y - a.y;
                        if (r) {
                            return r;
                        }
                        return b.x - a.x;
                    });

                    // process queue
                    var site = siteEvents.pop(),
                            siteid = 0,
                            xsitex, // to avoid duplicate sites
                            xsitey,
                            cells = this.cells,
                            circle;

                    // main loop
                    for (; ; ) {
                        // we need to figure whether we handle a site or circle event
                        // for this we find out if there is a site event and it is
                        // 'earlier' than the circle event
                        circle = this.firstCircleEvent;

                        // add beach section
                        if (site && (!circle || site.y < circle.y || (site.y === circle.y && site.x < circle.x))) {
                            // only if site is not a duplicate
                            if (site.x !== xsitex || site.y !== xsitey) {
                                // first create cell for new site
                                cells[siteid] = this.createCell(site);
                                site.voronoiId = siteid++;
                                // then create a beachsection for that site
                                this.addBeachsection(site);
                                // remember last site coords to detect duplicate
                                xsitey = site.y;
                                xsitex = site.x;
                            }
                            site = siteEvents.pop();
                        }

                        // remove beach section
                        else if (circle) {
                            this.removeBeachsection(circle.arc);
                        }

                        // all done, quit
                        else {
                            break;
                        }
                    }

                    // wrapping-up:
                    //   connect dangling edges to bounding box
                    //   cut edges as per bounding box
                    //   discard edges completely outside bounding box
                    //   discard edges which are point-like
                    this.clipEdges(bbox);

                    //   add missing edges in order to close opened cells
                    this.closeCells(bbox);

                    // to measure execution time
                    var stopTime = new Date();

                    // prepare return values
                    var diagram = new this.Diagram();
                    diagram.cells = this.cells;
                    diagram.edges = this.edges;
                    diagram.vertices = this.vertices;
                    diagram.execTime = stopTime.getTime() - startTime.getTime();

                    // clean up
                    this.reset();

                    return diagram;
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
                /*
                 * SECOND STEP: Tiding up of the graph.
                 *
                 * We use the method described by Gansner and North, based on Voronoi
                 * diagrams.
                 *
                 * Ref: doi:10.1007/3-540-37623-2_28
                 */

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
                    var inarray=[];
                dataVertices.forEach(function(node){
                        inarray.push(node.id);
                    });
                for (var i = 0; i < fv.length; ++i) {
                       inarray.forEach(
                            function(idnode){
                                if(idnode==fv[i].label)
                                { 
                                    
                                     pData['vertices'].push({id: fv[i].label, x: fv[i].x, y: fv[i].y});
                            }
                        });   
                            
                }
                return pData;


            }),
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

                /*global Math */

// ---------------------------------------------------------------------------

                function Voronoi() {
                    this.vertices = null;
                    this.edges = null;
                    this.cells = null;
                    this.toRecycle = null;
                    this.beachsectionJunkyard = [];
                    this.circleEventJunkyard = [];
                    this.vertexJunkyard = [];
                    this.edgeJunkyard = [];
                    this.cellJunkyard = [];
                }

// ---------------------------------------------------------------------------

                Voronoi.prototype.reset = function () {
                    if (!this.beachline) {
                        this.beachline = new this.RBTree();
                    }
                    // Move leftover beachsections to the beachsection junkyard.
                    if (this.beachline.root) {
                        var beachsection = this.beachline.getFirst(this.beachline.root);
                        while (beachsection) {
                            this.beachsectionJunkyard.push(beachsection); // mark for reuse
                            beachsection = beachsection.rbNext;
                        }
                    }
                    this.beachline.root = null;
                    if (!this.circleEvents) {
                        this.circleEvents = new this.RBTree();
                    }
                    this.circleEvents.root = this.firstCircleEvent = null;
                    this.vertices = [];
                    this.edges = [];
                    this.cells = [];
                };

                Voronoi.prototype.sqrt = Math.sqrt;
                Voronoi.prototype.abs = Math.abs;
                Voronoi.prototype.ε = Voronoi.ε = 1e-9;
                Voronoi.prototype.invε = Voronoi.invε = 1.0 / Voronoi.ε;
                Voronoi.prototype.equalWithEpsilon = function (a, b) {
                    return this.abs(a - b) < 1e-9;
                };
                Voronoi.prototype.greaterThanWithEpsilon = function (a, b) {
                    return a - b > 1e-9;
                };
                Voronoi.prototype.greaterThanOrEqualWithEpsilon = function (a, b) {
                    return b - a < 1e-9;
                };
                Voronoi.prototype.lessThanWithEpsilon = function (a, b) {
                    return b - a > 1e-9;
                };
                Voronoi.prototype.lessThanOrEqualWithEpsilon = function (a, b) {
                    return a - b < 1e-9;
                };

// ---------------------------------------------------------------------------
// Red-Black tree code (based on C version of "rbtree" by Franck Bui-Huu
// https://github.com/fbuihuu/libtree/blob/master/rb.c

                Voronoi.prototype.RBTree = function () {
                    this.root = null;
                };

                Voronoi.prototype.RBTree.prototype.rbInsertSuccessor = function (node, successor) {
                    var parent;
                    if (node) {
                        // >>> rhill 2011-05-27: Performance: cache previous/next nodes
                        successor.rbPrevious = node;
                        successor.rbNext = node.rbNext;
                        if (node.rbNext) {
                            node.rbNext.rbPrevious = successor;
                        }
                        node.rbNext = successor;
                        // <<<
                        if (node.rbRight) {
                            // in-place expansion of node.rbRight.getFirst();
                            node = node.rbRight;
                            while (node.rbLeft) {
                                node = node.rbLeft;
                            }
                            node.rbLeft = successor;
                        }
                        else {
                            node.rbRight = successor;
                        }
                        parent = node;
                    }
                    // rhill 2011-06-07: if node is null, successor must be inserted
                    // to the left-most part of the tree
                    else if (this.root) {
                        node = this.getFirst(this.root);
                        // >>> Performance: cache previous/next nodes
                        successor.rbPrevious = null;
                        successor.rbNext = node;
                        node.rbPrevious = successor;
                        // <<<
                        node.rbLeft = successor;
                        parent = node;
                    }
                    else {
                        // >>> Performance: cache previous/next nodes
                        successor.rbPrevious = successor.rbNext = null;
                        // <<<
                        this.root = successor;
                        parent = null;
                    }
                    successor.rbLeft = successor.rbRight = null;
                    successor.rbParent = parent;
                    successor.rbRed = true;
                    // Fixup the modified tree by recoloring nodes and performing
                    // rotations (2 at most) hence the red-black tree properties are
                    // preserved.
                    var grandpa, uncle;
                    node = successor;
                    while (parent && parent.rbRed) {
                        grandpa = parent.rbParent;
                        if (parent === grandpa.rbLeft) {
                            uncle = grandpa.rbRight;
                            if (uncle && uncle.rbRed) {
                                parent.rbRed = uncle.rbRed = false;
                                grandpa.rbRed = true;
                                node = grandpa;
                            }
                            else {
                                if (node === parent.rbRight) {
                                    this.rbRotateLeft(parent);
                                    node = parent;
                                    parent = node.rbParent;
                                }
                                parent.rbRed = false;
                                grandpa.rbRed = true;
                                this.rbRotateRight(grandpa);
                            }
                        }
                        else {
                            uncle = grandpa.rbLeft;
                            if (uncle && uncle.rbRed) {
                                parent.rbRed = uncle.rbRed = false;
                                grandpa.rbRed = true;
                                node = grandpa;
                            }
                            else {
                                if (node === parent.rbLeft) {
                                    this.rbRotateRight(parent);
                                    node = parent;
                                    parent = node.rbParent;
                                }
                                parent.rbRed = false;
                                grandpa.rbRed = true;
                                this.rbRotateLeft(grandpa);
                            }
                        }
                        parent = node.rbParent;
                    }
                    this.root.rbRed = false;
                };

                Voronoi.prototype.RBTree.prototype.rbRemoveNode = function (node) {
                    // >>> rhill 2011-05-27: Performance: cache previous/next nodes
                    if (node.rbNext) {
                        node.rbNext.rbPrevious = node.rbPrevious;
                    }
                    if (node.rbPrevious) {
                        node.rbPrevious.rbNext = node.rbNext;
                    }
                    node.rbNext = node.rbPrevious = null;
                    // <<<
                    var parent = node.rbParent,
                            left = node.rbLeft,
                            right = node.rbRight,
                            next;
                    if (!left) {
                        next = right;
                    }
                    else if (!right) {
                        next = left;
                    }
                    else {
                        next = this.getFirst(right);
                    }
                    if (parent) {
                        if (parent.rbLeft === node) {
                            parent.rbLeft = next;
                        }
                        else {
                            parent.rbRight = next;
                        }
                    }
                    else {
                        this.root = next;
                    }
                    // enforce red-black rules
                    var isRed;
                    if (left && right) {
                        isRed = next.rbRed;
                        next.rbRed = node.rbRed;
                        next.rbLeft = left;
                        left.rbParent = next;
                        if (next !== right) {
                            parent = next.rbParent;
                            next.rbParent = node.rbParent;
                            node = next.rbRight;
                            parent.rbLeft = node;
                            next.rbRight = right;
                            right.rbParent = next;
                        }
                        else {
                            next.rbParent = parent;
                            parent = next;
                            node = next.rbRight;
                        }
                    }
                    else {
                        isRed = node.rbRed;
                        node = next;
                    }
                    // 'node' is now the sole successor's child and 'parent' its
                    // new parent (since the successor can have been moved)
                    if (node) {
                        node.rbParent = parent;
                    }
                    // the 'easy' cases
                    if (isRed) {
                        return;
                    }
                    if (node && node.rbRed) {
                        node.rbRed = false;
                        return;
                    }
                    // the other cases
                    var sibling;
                    do {
                        if (node === this.root) {
                            break;
                        }
                        if (node === parent.rbLeft) {
                            sibling = parent.rbRight;
                            if (sibling.rbRed) {
                                sibling.rbRed = false;
                                parent.rbRed = true;
                                this.rbRotateLeft(parent);
                                sibling = parent.rbRight;
                            }
                            if ((sibling.rbLeft && sibling.rbLeft.rbRed) || (sibling.rbRight && sibling.rbRight.rbRed)) {
                                if (!sibling.rbRight || !sibling.rbRight.rbRed) {
                                    sibling.rbLeft.rbRed = false;
                                    sibling.rbRed = true;
                                    this.rbRotateRight(sibling);
                                    sibling = parent.rbRight;
                                }
                                sibling.rbRed = parent.rbRed;
                                parent.rbRed = sibling.rbRight.rbRed = false;
                                this.rbRotateLeft(parent);
                                node = this.root;
                                break;
                            }
                        }
                        else {
                            sibling = parent.rbLeft;
                            if (sibling.rbRed) {
                                sibling.rbRed = false;
                                parent.rbRed = true;
                                this.rbRotateRight(parent);
                                sibling = parent.rbLeft;
                            }
                            if ((sibling.rbLeft && sibling.rbLeft.rbRed) || (sibling.rbRight && sibling.rbRight.rbRed)) {
                                if (!sibling.rbLeft || !sibling.rbLeft.rbRed) {
                                    sibling.rbRight.rbRed = false;
                                    sibling.rbRed = true;
                                    this.rbRotateLeft(sibling);
                                    sibling = parent.rbLeft;
                                }
                                sibling.rbRed = parent.rbRed;
                                parent.rbRed = sibling.rbLeft.rbRed = false;
                                this.rbRotateRight(parent);
                                node = this.root;
                                break;
                            }
                        }
                        sibling.rbRed = true;
                        node = parent;
                        parent = parent.rbParent;
                    } while (!node.rbRed);
                    if (node) {
                        node.rbRed = false;
                    }
                };

                Voronoi.prototype.RBTree.prototype.rbRotateLeft = function (node) {
                    var p = node,
                            q = node.rbRight, // can't be null
                            parent = p.rbParent;
                    if (parent) {
                        if (parent.rbLeft === p) {
                            parent.rbLeft = q;
                        }
                        else {
                            parent.rbRight = q;
                        }
                    }
                    else {
                        this.root = q;
                    }
                    q.rbParent = parent;
                    p.rbParent = q;
                    p.rbRight = q.rbLeft;
                    if (p.rbRight) {
                        p.rbRight.rbParent = p;
                    }
                    q.rbLeft = p;
                };

                Voronoi.prototype.RBTree.prototype.rbRotateRight = function (node) {
                    var p = node,
                            q = node.rbLeft, // can't be null
                            parent = p.rbParent;
                    if (parent) {
                        if (parent.rbLeft === p) {
                            parent.rbLeft = q;
                        }
                        else {
                            parent.rbRight = q;
                        }
                    }
                    else {
                        this.root = q;
                    }
                    q.rbParent = parent;
                    p.rbParent = q;
                    p.rbLeft = q.rbRight;
                    if (p.rbLeft) {
                        p.rbLeft.rbParent = p;
                    }
                    q.rbRight = p;
                };

                Voronoi.prototype.RBTree.prototype.getFirst = function (node) {
                    while (node.rbLeft) {
                        node = node.rbLeft;
                    }
                    return node;
                };

                Voronoi.prototype.RBTree.prototype.getLast = function (node) {
                    while (node.rbRight) {
                        node = node.rbRight;
                    }
                    return node;
                };

// ---------------------------------------------------------------------------
// Diagram methods

                Voronoi.prototype.Diagram = function (site) {
                    this.site = site;
                };

// ---------------------------------------------------------------------------
// Cell methods

                Voronoi.prototype.Cell = function (site) {
                    this.site = site;
                    this.halfedges = [];
                    this.closeMe = false;
                };

                Voronoi.prototype.Cell.prototype.init = function (site) {
                    this.site = site;
                    this.halfedges = [];
                    this.closeMe = false;
                    return this;
                };

                Voronoi.prototype.createCell = function (site) {
                    var cell = this.cellJunkyard.pop();
                    if (cell) {
                        return cell.init(site);
                    }
                    return new this.Cell(site);
                };

                Voronoi.prototype.Cell.prototype.prepareHalfedges = function () {
                    var halfedges = this.halfedges,
                            iHalfedge = halfedges.length,
                            edge;
                    // get rid of unused halfedges
                    // rhill 2011-05-27: Keep it simple, no point here in trying
                    // to be fancy: dangling edges are a typically a minority.
                    while (iHalfedge--) {
                        edge = halfedges[iHalfedge].edge;
                        if (!edge.vb || !edge.va) {
                            halfedges.splice(iHalfedge, 1);
                        }
                    }

                    // rhill 2011-05-26: I tried to use a binary search at insertion
                    // time to keep the array sorted on-the-fly (in Cell.addHalfedge()).
                    // There was no real benefits in doing so, performance on
                    // Firefox 3.6 was improved marginally, while performance on
                    // Opera 11 was penalized marginally.
                    halfedges.sort(function (a, b) {
                        return b.angle - a.angle;
                    });
                    return halfedges.length;
                };

// Return a list of the neighbor Ids
                Voronoi.prototype.Cell.prototype.getNeighborIds = function () {
                    var neighbors = [],
                            iHalfedge = this.halfedges.length,
                            edge;
                    while (iHalfedge--) {
                        edge = this.halfedges[iHalfedge].edge;
                        if (edge.lSite !== null && edge.lSite.voronoiId != this.site.voronoiId) {
                            neighbors.push(edge.lSite.voronoiId);
                        }
                        else if (edge.rSite !== null && edge.rSite.voronoiId != this.site.voronoiId) {
                            neighbors.push(edge.rSite.voronoiId);
                        }
                    }
                    return neighbors;
                };

// Compute bounding box
//
                Voronoi.prototype.Cell.prototype.getBbox = function () {
                    var halfedges = this.halfedges,
                            iHalfedge = halfedges.length,
                            xmin = Infinity,
                            ymin = Infinity,
                            xmax = -Infinity,
                            ymax = -Infinity,
                            v, vx, vy;
                    while (iHalfedge--) {
                        v = halfedges[iHalfedge].getStartpoint();
                        vx = v.x;
                        vy = v.y;
                        if (vx < xmin) {
                            xmin = vx;
                        }
                        if (vy < ymin) {
                            ymin = vy;
                        }
                        if (vx > xmax) {
                            xmax = vx;
                        }
                        if (vy > ymax) {
                            ymax = vy;
                        }
                        // we dont need to take into account end point,
                        // since each end point matches a start point
                    }
                    return {
                        x: xmin,
                        y: ymin,
                        width: xmax - xmin,
                        height: ymax - ymin
                    };
                };

// Return whether a point is inside, on, or outside the cell:
//   -1: point is outside the perimeter of the cell
//    0: point is on the perimeter of the cell
//    1: point is inside the perimeter of the cell
//
                Voronoi.prototype.Cell.prototype.pointIntersection = function (x, y) {
                    // Check if point in polygon. Since all polygons of a Voronoi
                    // diagram are convex, then:
                    // http://paulbourke.net/geometry/polygonmesh/
                    // Solution 3 (2D):
                    //   "If the polygon is convex then one can consider the polygon
                    //   "as a 'path' from the first vertex. A point is on the interior
                    //   "of this polygons if it is always on the same side of all the
                    //   "line segments making up the path. ...
                    //   "(y - y0) (x1 - x0) - (x - x0) (y1 - y0)
                    //   "if it is less than 0 then P is to the right of the line segment,
                    //   "if greater than 0 it is to the left, if equal to 0 then it lies
                    //   "on the line segment"
                    var halfedges = this.halfedges,
                            iHalfedge = halfedges.length,
                            halfedge,
                            p0, p1, r;
                    while (iHalfedge--) {
                        halfedge = halfedges[iHalfedge];
                        p0 = halfedge.getStartpoint();
                        p1 = halfedge.getEndpoint();
                        r = (y - p0.y) * (p1.x - p0.x) - (x - p0.x) * (p1.y - p0.y);
                        if (!r) {
                            return 0;
                        }
                        if (r > 0) {
                            return -1;
                        }
                    }
                    return 1;
                };

// ---------------------------------------------------------------------------
// Edge methods
//

                Voronoi.prototype.Vertex = function (x, y) {
                    this.x = x;
                    this.y = y;
                };

                Voronoi.prototype.Edge = function (lSite, rSite) {
                    this.lSite = lSite;
                    this.rSite = rSite;
                    this.va = this.vb = null;
                };

                Voronoi.prototype.Halfedge = function (edge, lSite, rSite) {
                    this.site = lSite;
                    this.edge = edge;
                    // 'angle' is a value to be used for properly sorting the
                    // halfsegments counterclockwise. By convention, we will
                    // use the angle of the line defined by the 'site to the left'
                    // to the 'site to the right'.
                    // However, border edges have no 'site to the right': thus we
                    // use the angle of line perpendicular to the halfsegment (the
                    // edge should have both end points defined in such case.)
                    if (rSite) {
                        this.angle = Math.atan2(rSite.y - lSite.y, rSite.x - lSite.x);
                    }
                    else {
                        var va = edge.va,
                                vb = edge.vb;
                        // rhill 2011-05-31: used to call getStartpoint()/getEndpoint(),
                        // but for performance purpose, these are expanded in place here.
                        this.angle = edge.lSite === lSite ?
                                Math.atan2(vb.x - va.x, va.y - vb.y) :
                                Math.atan2(va.x - vb.x, vb.y - va.y);
                    }
                };

                Voronoi.prototype.createHalfedge = function (edge, lSite, rSite) {
                    return new this.Halfedge(edge, lSite, rSite);
                };

                Voronoi.prototype.Halfedge.prototype.getStartpoint = function () {
                    return this.edge.lSite === this.site ? this.edge.va : this.edge.vb;
                };

                Voronoi.prototype.Halfedge.prototype.getEndpoint = function () {
                    return this.edge.lSite === this.site ? this.edge.vb : this.edge.va;
                };



// this create and add a vertex to the internal collection

                Voronoi.prototype.createVertex = function (x, y) {
                    var v = this.vertexJunkyard.pop();
                    if (!v) {
                        v = new this.Vertex(x, y);
                    }
                    else {
                        v.x = x;
                        v.y = y;
                    }
                    this.vertices.push(v);
                    return v;
                };

// this create and add an edge to internal collection, and also create
// two halfedges which are added to each site's counterclockwise array
// of halfedges.

                Voronoi.prototype.createEdge = function (lSite, rSite, va, vb) {
                    var edge = this.edgeJunkyard.pop();
                    if (!edge) {
                        edge = new this.Edge(lSite, rSite);
                    }
                    else {
                        edge.lSite = lSite;
                        edge.rSite = rSite;
                        edge.va = edge.vb = null;
                    }

                    this.edges.push(edge);
                    if (va) {
                        this.setEdgeStartpoint(edge, lSite, rSite, va);
                    }
                    if (vb) {
                        this.setEdgeEndpoint(edge, lSite, rSite, vb);
                    }
                    this.cells[lSite.voronoiId].halfedges.push(this.createHalfedge(edge, lSite, rSite));
                    this.cells[rSite.voronoiId].halfedges.push(this.createHalfedge(edge, rSite, lSite));
                    return edge;
                };

                Voronoi.prototype.createBorderEdge = function (lSite, va, vb) {
                    var edge = this.edgeJunkyard.pop();
                    if (!edge) {
                        edge = new this.Edge(lSite, null);
                    }
                    else {
                        edge.lSite = lSite;
                        edge.rSite = null;
                    }
                    edge.va = va;
                    edge.vb = vb;
                    this.edges.push(edge);
                    return edge;
                };

                Voronoi.prototype.setEdgeStartpoint = function (edge, lSite, rSite, vertex) {
                    if (!edge.va && !edge.vb) {
                        edge.va = vertex;
                        edge.lSite = lSite;
                        edge.rSite = rSite;
                    }
                    else if (edge.lSite === rSite) {
                        edge.vb = vertex;
                    }
                    else {
                        edge.va = vertex;
                    }
                };

                Voronoi.prototype.setEdgeEndpoint = function (edge, lSite, rSite, vertex) {
                    this.setEdgeStartpoint(edge, rSite, lSite, vertex);
                };

// ---------------------------------------------------------------------------
// Beachline methods

// rhill 2011-06-07: For some reasons, performance suffers significantly
// when instanciating a literal object instead of an empty ctor
                Voronoi.prototype.Beachsection = function () {
                };

// rhill 2011-06-02: A lot of Beachsection instanciations
// occur during the computation of the Voronoi diagram,
// somewhere between the number of sites and twice the
// number of sites, while the number of Beachsections on the
// beachline at any given time is comparatively low. For this
// reason, we reuse already created Beachsections, in order
// to avoid new memory allocation. This resulted in a measurable
// performance gain.

                Voronoi.prototype.createBeachsection = function (site) {
                    var beachsection = this.beachsectionJunkyard.pop();
                    if (!beachsection) {
                        beachsection = new this.Beachsection();
                    }
                    beachsection.site = site;
                    return beachsection;
                };

// calculate the left break point of a particular beach section,
// given a particular sweep line
                Voronoi.prototype.leftBreakPoint = function (arc, directrix) {
                    // http://en.wikipedia.org/wiki/Parabola
                    // http://en.wikipedia.org/wiki/Quadratic_equation
                    // h1 = x1,
                    // k1 = (y1+directrix)/2,
                    // h2 = x2,
                    // k2 = (y2+directrix)/2,
                    // p1 = k1-directrix,
                    // a1 = 1/(4*p1),
                    // b1 = -h1/(2*p1),
                    // c1 = h1*h1/(4*p1)+k1,
                    // p2 = k2-directrix,
                    // a2 = 1/(4*p2),
                    // b2 = -h2/(2*p2),
                    // c2 = h2*h2/(4*p2)+k2,
                    // x = (-(b2-b1) + Math.sqrt((b2-b1)*(b2-b1) - 4*(a2-a1)*(c2-c1))) / (2*(a2-a1))
                    // When x1 become the x-origin:
                    // h1 = 0,
                    // k1 = (y1+directrix)/2,
                    // h2 = x2-x1,
                    // k2 = (y2+directrix)/2,
                    // p1 = k1-directrix,
                    // a1 = 1/(4*p1),
                    // b1 = 0,
                    // c1 = k1,
                    // p2 = k2-directrix,
                    // a2 = 1/(4*p2),
                    // b2 = -h2/(2*p2),
                    // c2 = h2*h2/(4*p2)+k2,
                    // x = (-b2 + Math.sqrt(b2*b2 - 4*(a2-a1)*(c2-k1))) / (2*(a2-a1)) + x1

                    // change code below at your own risk: care has been taken to
                    // reduce errors due to computers' finite arithmetic precision.
                    // Maybe can still be improved, will see if any more of this
                    // kind of errors pop up again.
                    var site = arc.site,
                            rfocx = site.x,
                            rfocy = site.y,
                            pby2 = rfocy - directrix;
                    // parabola in degenerate case where focus is on directrix
                    if (!pby2) {
                        return rfocx;
                    }
                    var lArc = arc.rbPrevious;
                    if (!lArc) {
                        return -Infinity;
                    }
                    site = lArc.site;
                    var lfocx = site.x,
                            lfocy = site.y,
                            plby2 = lfocy - directrix;
                    // parabola in degenerate case where focus is on directrix
                    if (!plby2) {
                        return lfocx;
                    }
                    var hl = lfocx - rfocx,
                            aby2 = 1 / pby2 - 1 / plby2,
                            b = hl / plby2;
                    if (aby2) {
                        return (-b + this.sqrt(b * b - 2 * aby2 * (hl * hl / (-2 * plby2) - lfocy + plby2 / 2 + rfocy - pby2 / 2))) / aby2 + rfocx;
                    }
                    // both parabolas have same distance to directrix, thus break point is midway
                    return (rfocx + lfocx) / 2;
                };

// calculate the right break point of a particular beach section,
// given a particular directrix
                Voronoi.prototype.rightBreakPoint = function (arc, directrix) {
                    var rArc = arc.rbNext;
                    if (rArc) {
                        return this.leftBreakPoint(rArc, directrix);
                    }
                    var site = arc.site;
                    return site.y === directrix ? site.x : Infinity;
                };

                Voronoi.prototype.detachBeachsection = function (beachsection) {
                    this.detachCircleEvent(beachsection); // detach potentially attached circle event
                    this.beachline.rbRemoveNode(beachsection); // remove from RB-tree
                    this.beachsectionJunkyard.push(beachsection); // mark for reuse
                };

                Voronoi.prototype.removeBeachsection = function (beachsection) {
                    var circle = beachsection.circleEvent,
                            x = circle.x,
                            y = circle.ycenter,
                            vertex = this.createVertex(x, y),
                            previous = beachsection.rbPrevious,
                            next = beachsection.rbNext,
                            disappearingTransitions = [beachsection],
                            abs_fn = Math.abs;

                    // remove collapsed beachsection from beachline
                    this.detachBeachsection(beachsection);

                    // there could be more than one empty arc at the deletion point, this
                    // happens when more than two edges are linked by the same vertex,
                    // so we will collect all those edges by looking up both sides of
                    // the deletion point.
                    // by the way, there is *always* a predecessor/successor to any collapsed
                    // beach section, it's just impossible to have a collapsing first/last
                    // beach sections on the beachline, since they obviously are unconstrained
                    // on their left/right side.

                    // look left
                    var lArc = previous;
                    while (lArc.circleEvent && abs_fn(x - lArc.circleEvent.x) < 1e-9 && abs_fn(y - lArc.circleEvent.ycenter) < 1e-9) {
                        previous = lArc.rbPrevious;
                        disappearingTransitions.unshift(lArc);
                        this.detachBeachsection(lArc); // mark for reuse
                        lArc = previous;
                    }
                    // even though it is not disappearing, I will also add the beach section
                    // immediately to the left of the left-most collapsed beach section, for
                    // convenience, since we need to refer to it later as this beach section
                    // is the 'left' site of an edge for which a start point is set.
                    disappearingTransitions.unshift(lArc);
                    this.detachCircleEvent(lArc);

                    // look right
                    var rArc = next;
                    while (rArc.circleEvent && abs_fn(x - rArc.circleEvent.x) < 1e-9 && abs_fn(y - rArc.circleEvent.ycenter) < 1e-9) {
                        next = rArc.rbNext;
                        disappearingTransitions.push(rArc);
                        this.detachBeachsection(rArc); // mark for reuse
                        rArc = next;
                    }
                    // we also have to add the beach section immediately to the right of the
                    // right-most collapsed beach section, since there is also a disappearing
                    // transition representing an edge's start point on its left.
                    disappearingTransitions.push(rArc);
                    this.detachCircleEvent(rArc);

                    // walk through all the disappearing transitions between beach sections and
                    // set the start point of their (implied) edge.
                    var nArcs = disappearingTransitions.length,
                            iArc;
                    for (iArc = 1; iArc < nArcs; iArc++) {
                        rArc = disappearingTransitions[iArc];
                        lArc = disappearingTransitions[iArc - 1];
                        this.setEdgeStartpoint(rArc.edge, lArc.site, rArc.site, vertex);
                    }

                    // create a new edge as we have now a new transition between
                    // two beach sections which were previously not adjacent.
                    // since this edge appears as a new vertex is defined, the vertex
                    // actually define an end point of the edge (relative to the site
                    // on the left)
                    lArc = disappearingTransitions[0];
                    rArc = disappearingTransitions[nArcs - 1];
                    rArc.edge = this.createEdge(lArc.site, rArc.site, undefined, vertex);

                    // create circle events if any for beach sections left in the beachline
                    // adjacent to collapsed sections
                    this.attachCircleEvent(lArc);
                    this.attachCircleEvent(rArc);
                };

                Voronoi.prototype.addBeachsection = function (site) {
                    var x = site.x,
                            directrix = site.y;

                    // find the left and right beach sections which will surround the newly
                    // created beach section.
                    // rhill 2011-06-01: This loop is one of the most often executed,
                    // hence we expand in-place the comparison-against-epsilon calls.
                    var lArc, rArc,
                            dxl, dxr,
                            node = this.beachline.root;

                    while (node) {
                        dxl = this.leftBreakPoint(node, directrix) - x;
                        // x lessThanWithEpsilon xl => falls somewhere before the left edge of the beachsection
                        if (dxl > 1e-9) {
                            // this case should never happen
                            // if (!node.rbLeft) {
                            //    rArc = node.rbLeft;
                            //    break;
                            //    }
                            node = node.rbLeft;
                        }
                        else {
                            dxr = x - this.rightBreakPoint(node, directrix);
                            // x greaterThanWithEpsilon xr => falls somewhere after the right edge of the beachsection
                            if (dxr > 1e-9) {
                                if (!node.rbRight) {
                                    lArc = node;
                                    break;
                                }
                                node = node.rbRight;
                            }
                            else {
                                // x equalWithEpsilon xl => falls exactly on the left edge of the beachsection
                                if (dxl > -1e-9) {
                                    lArc = node.rbPrevious;
                                    rArc = node;
                                }
                                // x equalWithEpsilon xr => falls exactly on the right edge of the beachsection
                                else if (dxr > -1e-9) {
                                    lArc = node;
                                    rArc = node.rbNext;
                                }
                                // falls exactly somewhere in the middle of the beachsection
                                else {
                                    lArc = rArc = node;
                                }
                                break;
                            }
                        }
                    }
                    // at this point, keep in mind that lArc and/or rArc could be
                    // undefined or null.

                    // create a new beach section object for the site and add it to RB-tree
                    var newArc = this.createBeachsection(site);
                    this.beachline.rbInsertSuccessor(lArc, newArc);

                    // cases:
                    //

                    // [null,null]
                    // least likely case: new beach section is the first beach section on the
                    // beachline.
                    // This case means:
                    //   no new transition appears
                    //   no collapsing beach section
                    //   new beachsection become root of the RB-tree
                    if (!lArc && !rArc) {
                        return;
                    }

                    // [lArc,rArc] where lArc == rArc
                    // most likely case: new beach section split an existing beach
                    // section.
                    // This case means:
                    //   one new transition appears
                    //   the left and right beach section might be collapsing as a result
                    //   two new nodes added to the RB-tree
                    if (lArc === rArc) {
                        // invalidate circle event of split beach section
                        this.detachCircleEvent(lArc);

                        // split the beach section into two separate beach sections
                        rArc = this.createBeachsection(lArc.site);
                        this.beachline.rbInsertSuccessor(newArc, rArc);

                        // since we have a new transition between two beach sections,
                        // a new edge is born
                        newArc.edge = rArc.edge = this.createEdge(lArc.site, newArc.site);

                        // check whether the left and right beach sections are collapsing
                        // and if so create circle events, to be notified when the point of
                        // collapse is reached.
                        this.attachCircleEvent(lArc);
                        this.attachCircleEvent(rArc);
                        return;
                    }

                    // [lArc,null]
                    // even less likely case: new beach section is the *last* beach section
                    // on the beachline -- this can happen *only* if *all* the previous beach
                    // sections currently on the beachline share the same y value as
                    // the new beach section.
                    // This case means:
                    //   one new transition appears
                    //   no collapsing beach section as a result
                    //   new beach section become right-most node of the RB-tree
                    if (lArc && !rArc) {
                        newArc.edge = this.createEdge(lArc.site, newArc.site);
                        return;
                    }

                    // [null,rArc]
                    // impossible case: because sites are strictly processed from top to bottom,
                    // and left to right, which guarantees that there will always be a beach section
                    // on the left -- except of course when there are no beach section at all on
                    // the beach line, which case was handled above.
                    // rhill 2011-06-02: No point testing in non-debug version
                    //if (!lArc && rArc) {
                    //    throw "Voronoi.addBeachsection(): What is this I don't even";
                    //    }

                    // [lArc,rArc] where lArc != rArc
                    // somewhat less likely case: new beach section falls *exactly* in between two
                    // existing beach sections
                    // This case means:
                    //   one transition disappears
                    //   two new transitions appear
                    //   the left and right beach section might be collapsing as a result
                    //   only one new node added to the RB-tree
                    if (lArc !== rArc) {
                        // invalidate circle events of left and right sites
                        this.detachCircleEvent(lArc);
                        this.detachCircleEvent(rArc);

                        // an existing transition disappears, meaning a vertex is defined at
                        // the disappearance point.
                        // since the disappearance is caused by the new beachsection, the
                        // vertex is at the center of the circumscribed circle of the left,
                        // new and right beachsections.
                        // http://mathforum.org/library/drmath/view/55002.html
                        // Except that I bring the origin at A to simplify
                        // calculation
                        var lSite = lArc.site,
                                ax = lSite.x,
                                ay = lSite.y,
                                bx = site.x - ax,
                                by = site.y - ay,
                                rSite = rArc.site,
                                cx = rSite.x - ax,
                                cy = rSite.y - ay,
                                d = 2 * (bx * cy - by * cx),
                                hb = bx * bx + by * by,
                                hc = cx * cx + cy * cy,
                                vertex = this.createVertex((cy * hb - by * hc) / d + ax, (bx * hc - cx * hb) / d + ay);

                        // one transition disappear
                        this.setEdgeStartpoint(rArc.edge, lSite, rSite, vertex);

                        // two new transitions appear at the new vertex location
                        newArc.edge = this.createEdge(lSite, site, undefined, vertex);
                        rArc.edge = this.createEdge(site, rSite, undefined, vertex);

                        // check whether the left and right beach sections are collapsing
                        // and if so create circle events, to handle the point of collapse.
                        this.attachCircleEvent(lArc);
                        this.attachCircleEvent(rArc);
                        return;
                    }
                };

// ---------------------------------------------------------------------------
// Circle event methods

// rhill 2011-06-07: For some reasons, performance suffers significantly
// when instanciating a literal object instead of an empty ctor
                Voronoi.prototype.CircleEvent = function () {
                    // rhill 2013-10-12: it helps to state exactly what we are at ctor time.
                    this.arc = null;
                    this.rbLeft = null;
                    this.rbNext = null;
                    this.rbParent = null;
                    this.rbPrevious = null;
                    this.rbRed = false;
                    this.rbRight = null;
                    this.site = null;
                    this.x = this.y = this.ycenter = 0;
                };

                Voronoi.prototype.attachCircleEvent = function (arc) {
                    var lArc = arc.rbPrevious,
                            rArc = arc.rbNext;
                    if (!lArc || !rArc) {
                        return;
                    } // does that ever happen?
                    var lSite = lArc.site,
                            cSite = arc.site,
                            rSite = rArc.site;

                    // If site of left beachsection is same as site of
                    // right beachsection, there can't be convergence
                    if (lSite === rSite) {
                        return;
                    }

                    // Find the circumscribed circle for the three sites associated
                    // with the beachsection triplet.
                    // rhill 2011-05-26: It is more efficient to calculate in-place
                    // rather than getting the resulting circumscribed circle from an
                    // object returned by calling Voronoi.circumcircle()
                    // http://mathforum.org/library/drmath/view/55002.html
                    // Except that I bring the origin at cSite to simplify calculations.
                    // The bottom-most part of the circumcircle is our Fortune 'circle
                    // event', and its center is a vertex potentially part of the final
                    // Voronoi diagram.
                    var bx = cSite.x,
                            by = cSite.y,
                            ax = lSite.x - bx,
                            ay = lSite.y - by,
                            cx = rSite.x - bx,
                            cy = rSite.y - by;

                    // If points l->c->r are clockwise, then center beach section does not
                    // collapse, hence it can't end up as a vertex (we reuse 'd' here, which
                    // sign is reverse of the orientation, hence we reverse the test.
                    // http://en.wikipedia.org/wiki/Curve_orientation#Orientation_of_a_simple_polygon
                    // rhill 2011-05-21: Nasty finite precision error which caused circumcircle() to
                    // return infinites: 1e-12 seems to fix the problem.
                    var d = 2 * (ax * cy - ay * cx);
                    if (d >= -2e-12) {
                        return;
                    }

                    var ha = ax * ax + ay * ay,
                            hc = cx * cx + cy * cy,
                            x = (cy * ha - ay * hc) / d,
                            y = (ax * hc - cx * ha) / d,
                            ycenter = y + by;

                    // Important: ybottom should always be under or at sweep, so no need
                    // to waste CPU cycles by checking

                    // recycle circle event object if possible
                    var circleEvent = this.circleEventJunkyard.pop();
                    if (!circleEvent) {
                        circleEvent = new this.CircleEvent();
                    }
                    circleEvent.arc = arc;
                    circleEvent.site = cSite;
                    circleEvent.x = x + bx;
                    circleEvent.y = ycenter + this.sqrt(x * x + y * y); // y bottom
                    circleEvent.ycenter = ycenter;
                    arc.circleEvent = circleEvent;

                    // find insertion point in RB-tree: circle events are ordered from
                    // smallest to largest
                    var predecessor = null,
                            node = this.circleEvents.root;
                    while (node) {
                        if (circleEvent.y < node.y || (circleEvent.y === node.y && circleEvent.x <= node.x)) {
                            if (node.rbLeft) {
                                node = node.rbLeft;
                            }
                            else {
                                predecessor = node.rbPrevious;
                                break;
                            }
                        }
                        else {
                            if (node.rbRight) {
                                node = node.rbRight;
                            }
                            else {
                                predecessor = node;
                                break;
                            }
                        }
                    }
                    this.circleEvents.rbInsertSuccessor(predecessor, circleEvent);
                    if (!predecessor) {
                        this.firstCircleEvent = circleEvent;
                    }
                };

                Voronoi.prototype.detachCircleEvent = function (arc) {
                    var circleEvent = arc.circleEvent;
                    if (circleEvent) {
                        if (!circleEvent.rbPrevious) {
                            this.firstCircleEvent = circleEvent.rbNext;
                        }
                        this.circleEvents.rbRemoveNode(circleEvent); // remove from RB-tree
                        this.circleEventJunkyard.push(circleEvent);
                        arc.circleEvent = null;
                    }
                };

// ---------------------------------------------------------------------------
// Diagram completion methods

// connect dangling edges (not if a cursory test tells us
// it is not going to be visible.
// return value:
//   false: the dangling endpoint couldn't be connected
//   true: the dangling endpoint could be connected
                Voronoi.prototype.connectEdge = function (edge, bbox) {
                    // skip if end point already connected
                    var vb = edge.vb;
                    if (!!vb) {
                        return true;
                    }

                    // make local copy for performance purpose
                    var va = edge.va,
                            xl = bbox.xl,
                            xr = bbox.xr,
                            yt = bbox.yt,
                            yb = bbox.yb,
                            lSite = edge.lSite,
                            rSite = edge.rSite,
                            lx = lSite.x,
                            ly = lSite.y,
                            rx = rSite.x,
                            ry = rSite.y,
                            fx = (lx + rx) / 2,
                            fy = (ly + ry) / 2,
                            fm, fb;

                    // if we reach here, this means cells which use this edge will need
                    // to be closed, whether because the edge was removed, or because it
                    // was connected to the bounding box.
                    this.cells[lSite.voronoiId].closeMe = true;
                    this.cells[rSite.voronoiId].closeMe = true;

                    // get the line equation of the bisector if line is not vertical
                    if (ry !== ly) {
                        fm = (lx - rx) / (ry - ly);
                        fb = fy - fm * fx;
                    }

                    // remember, direction of line (relative to left site):
                    // upward: left.x < right.x
                    // downward: left.x > right.x
                    // horizontal: left.x == right.x
                    // upward: left.x < right.x
                    // rightward: left.y < right.y
                    // leftward: left.y > right.y
                    // vertical: left.y == right.y

                    // depending on the direction, find the best side of the
                    // bounding box to use to determine a reasonable start point

                    // rhill 2013-12-02:
                    // While at it, since we have the values which define the line,
                    // clip the end of va if it is outside the bbox.
                    // https://github.com/gorhill/Javascript-Voronoi/issues/15
                    // TODO: Do all the clipping here rather than rely on Liang-Barsky
                    // which does not do well sometimes due to loss of arithmetic
                    // precision. The code here doesn't degrade if one of the vertex is
                    // at a huge distance.

                    // special case: vertical line
                    if (fm === undefined) {
                        // doesn't intersect with viewport
                        if (fx < xl || fx >= xr) {
                            return false;
                        }
                        // downward
                        if (lx > rx) {
                            if (!va || va.y < yt) {
                                va = this.createVertex(fx, yt);
                            }
                            else if (va.y >= yb) {
                                return false;
                            }
                            vb = this.createVertex(fx, yb);
                        }
                        // upward
                        else {
                            if (!va || va.y > yb) {
                                va = this.createVertex(fx, yb);
                            }
                            else if (va.y < yt) {
                                return false;
                            }
                            vb = this.createVertex(fx, yt);
                        }
                    }
                    // closer to vertical than horizontal, connect start point to the
                    // top or bottom side of the bounding box
                    else if (fm < -1 || fm > 1) {
                        // downward
                        if (lx > rx) {
                            if (!va || va.y < yt) {
                                va = this.createVertex((yt - fb) / fm, yt);
                            }
                            else if (va.y >= yb) {
                                return false;
                            }
                            vb = this.createVertex((yb - fb) / fm, yb);
                        }
                        // upward
                        else {
                            if (!va || va.y > yb) {
                                va = this.createVertex((yb - fb) / fm, yb);
                            }
                            else if (va.y < yt) {
                                return false;
                            }
                            vb = this.createVertex((yt - fb) / fm, yt);
                        }
                    }
                    // closer to horizontal than vertical, connect start point to the
                    // left or right side of the bounding box
                    else {
                        // rightward
                        if (ly < ry) {
                            if (!va || va.x < xl) {
                                va = this.createVertex(xl, fm * xl + fb);
                            }
                            else if (va.x >= xr) {
                                return false;
                            }
                            vb = this.createVertex(xr, fm * xr + fb);
                        }
                        // leftward
                        else {
                            if (!va || va.x > xr) {
                                va = this.createVertex(xr, fm * xr + fb);
                            }
                            else if (va.x < xl) {
                                return false;
                            }
                            vb = this.createVertex(xl, fm * xl + fb);
                        }
                    }
                    edge.va = va;
                    edge.vb = vb;

                    return true;
                };

// line-clipping code taken from:
//   Liang-Barsky function by Daniel White
//   http://www.skytopia.com/project/articles/compsci/clipping.html
// Thanks!
// A bit modified to minimize code paths
                Voronoi.prototype.clipEdge = function (edge, bbox) {
                    var ax = edge.va.x,
                            ay = edge.va.y,
                            bx = edge.vb.x,
                            by = edge.vb.y,
                            t0 = 0,
                            t1 = 1,
                            dx = bx - ax,
                            dy = by - ay;
                    // left
                    var q = ax - bbox.xl;
                    if (dx === 0 && q < 0) {
                        return false;
                    }
                    var r = -q / dx;
                    if (dx < 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }
                    else if (dx > 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    // right
                    q = bbox.xr - ax;
                    if (dx === 0 && q < 0) {
                        return false;
                    }
                    r = q / dx;
                    if (dx < 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    else if (dx > 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }
                    // top
                    q = ay - bbox.yt;
                    if (dy === 0 && q < 0) {
                        return false;
                    }
                    r = -q / dy;
                    if (dy < 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }
                    else if (dy > 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    // bottom        
                    q = bbox.yb - ay;
                    if (dy === 0 && q < 0) {
                        return false;
                    }
                    r = q / dy;
                    if (dy < 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    else if (dy > 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }

                    // if we reach this point, Voronoi edge is within bbox

                    // if t0 > 0, va needs to change
                    // rhill 2011-06-03: we need to create a new vertex rather
                    // than modifying the existing one, since the existing
                    // one is likely shared with at least another edge
                    if (t0 > 0) {
                        edge.va = this.createVertex(ax + t0 * dx, ay + t0 * dy);
                    }

                    // if t1 < 1, vb needs to change
                    // rhill 2011-06-03: we need to create a new vertex rather
                    // than modifying the existing one, since the existing
                    // one is likely shared with at least another edge
                    if (t1 < 1) {
                        edge.vb = this.createVertex(ax + t1 * dx, ay + t1 * dy);
                    }

                    // va and/or vb were clipped, thus we will need to close
                    // cells which use this edge.
                    if (t0 > 0 || t1 < 1) {
                        this.cells[edge.lSite.voronoiId].closeMe = true;
                        this.cells[edge.rSite.voronoiId].closeMe = true;
                    }

                    return true;
                };

// Connect/cut edges at bounding box
                Voronoi.prototype.clipEdges = function (bbox) {
                    // connect all dangling edges to bounding box
                    // or get rid of them if it can't be done
                    var edges = this.edges,
                            iEdge = edges.length,
                            edge,
                            abs_fn = Math.abs;

                    // iterate backward so we can splice safely
                    while (iEdge--) {
                        edge = edges[iEdge];
                        // edge is removed if:
                        //   it is wholly outside the bounding box
                        //   it is looking more like a point than a line
                        if (!this.connectEdge(edge, bbox) ||
                                !this.clipEdge(edge, bbox) ||
                                (abs_fn(edge.va.x - edge.vb.x) < 1e-9 && abs_fn(edge.va.y - edge.vb.y) < 1e-9)) {
                            edge.va = edge.vb = null;
                            edges.splice(iEdge, 1);
                        }
                    }
                };

// Close the cells.
// The cells are bound by the supplied bounding box.
// Each cell refers to its associated site, and a list
// of halfedges ordered counterclockwise.
                Voronoi.prototype.closeCells = function (bbox) {
                    var xl = bbox.xl,
                            xr = bbox.xr,
                            yt = bbox.yt,
                            yb = bbox.yb,
                            cells = this.cells,
                            iCell = cells.length,
                            cell,
                            iLeft,
                            halfedges, nHalfedges,
                            edge,
                            va, vb, vz,
                            lastBorderSegment,
                            abs_fn = Math.abs;

                    while (iCell--) {
                        cell = cells[iCell];
                        // prune, order halfedges counterclockwise, then add missing ones
                        // required to close cells
                        if (!cell.prepareHalfedges()) {
                            continue;
                        }
                        if (!cell.closeMe) {
                            continue;
                        }
                        // find first 'unclosed' point.
                        // an 'unclosed' point will be the end point of a halfedge which
                        // does not match the start point of the following halfedge
                        halfedges = cell.halfedges;
                        nHalfedges = halfedges.length;
                        // special case: only one site, in which case, the viewport is the cell
                        // ...

                        // all other cases
                        iLeft = 0;
                        while (iLeft < nHalfedges) {
                            va = halfedges[iLeft].getEndpoint();
                            vz = halfedges[(iLeft + 1) % nHalfedges].getStartpoint();
                            // if end point is not equal to start point, we need to add the missing
                            // halfedge(s) up to vz
                            if (abs_fn(va.x - vz.x) >= 1e-9 || abs_fn(va.y - vz.y) >= 1e-9) {

                                // rhill 2013-12-02:
                                // "Holes" in the halfedges are not necessarily always adjacent.
                                // https://github.com/gorhill/Javascript-Voronoi/issues/16

                                // find entry point:
                                switch (true) {

                                    // walk downward along left side
                                    case this.equalWithEpsilon(va.x, xl) && this.lessThanWithEpsilon(va.y, yb):
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xl);
                                        vb = this.createVertex(xl, lastBorderSegment ? vz.y : yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk rightward along bottom side
                                    case this.equalWithEpsilon(va.y, yb) && this.lessThanWithEpsilon(va.x, xr):
                                        lastBorderSegment = this.equalWithEpsilon(vz.y, yb);
                                        vb = this.createVertex(lastBorderSegment ? vz.x : xr, yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk upward along right side
                                    case this.equalWithEpsilon(va.x, xr) && this.greaterThanWithEpsilon(va.y, yt):
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xr);
                                        vb = this.createVertex(xr, lastBorderSegment ? vz.y : yt);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk leftward along top side
                                    case this.equalWithEpsilon(va.y, yt) && this.greaterThanWithEpsilon(va.x, xl):
                                        lastBorderSegment = this.equalWithEpsilon(vz.y, yt);
                                        vb = this.createVertex(lastBorderSegment ? vz.x : xl, yt);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk downward along left side
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xl);
                                        vb = this.createVertex(xl, lastBorderSegment ? vz.y : yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk rightward along bottom side
                                        lastBorderSegment = this.equalWithEpsilon(vz.y, yb);
                                        vb = this.createVertex(lastBorderSegment ? vz.x : xr, yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk upward along right side
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xr);
                                        vb = this.createVertex(xr, lastBorderSegment ? vz.y : yt);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        // fall through

                                    default:
                                        throw "Voronoi.closeCells() > this makes no sense!";
                                }
                            }
                            iLeft++;
                        }
                        cell.closeMe = false;
                    }
                };

// ---------------------------------------------------------------------------
// Debugging helper
                /*
                 Voronoi.prototype.dumpBeachline = function(y) {
                 console.log('Voronoi.dumpBeachline(%f) > Beachsections, from left to right:', y);
                 if ( !this.beachline ) {
                 console.log('  None');
                 }
                 else {
                 var bs = this.beachline.getFirst(this.beachline.root);
                 while ( bs ) {
                 console.log('  site %d: xl: %f, xr: %f', bs.site.voronoiId, this.leftBreakPoint(bs, y), this.rightBreakPoint(bs, y));
                 bs = bs.rbNext;
                 }
                 }
                 };
                 */

// ---------------------------------------------------------------------------
// Helper: Quantize sites

// rhill 2013-10-12:
// This is to solve https://github.com/gorhill/Javascript-Voronoi/issues/15
// Since not all users will end up using the kind of coord values which would
// cause the issue to arise, I chose to let the user decide whether or not
// he should sanitize his coord values through this helper. This way, for
// those users who uses coord values which are known to be fine, no overhead is
// added.

                Voronoi.prototype.quantizeSites = function (sites) {
                    var ε = this.ε,
                            n = sites.length,
                            site;
                    while (n--) {
                        site = sites[n];
                        site.x = Math.floor(site.x / ε) * ε;
                        site.y = Math.floor(site.y / ε) * ε;
                    }
                };

// ---------------------------------------------------------------------------
// Helper: Recycle diagram: all vertex, edge and cell objects are
// "surrendered" to the Voronoi object for reuse.
// TODO: rhill-voronoi-core v2: more performance to be gained
// when I change the semantic of what is returned.

                Voronoi.prototype.recycle = function (diagram) {
                    if (diagram) {
                        if (diagram instanceof this.Diagram) {
                            this.toRecycle = diagram;
                        }
                        else {
                            throw 'Voronoi.recycleDiagram() > Need a Diagram object.';
                        }
                    }
                };

// ---------------------------------------------------------------------------
// Top-level Fortune loop

// rhill 2011-05-19:
//   Voronoi sites are kept client-side now, to allow
//   user to freely modify content. At compute time,
//   *references* to sites are copied locally.

                Voronoi.prototype.compute = function (sites, bbox) {
                    // to measure execution time
                    var startTime = new Date();

                    // init internal state
                    this.reset();

                    // any diagram data available for recycling?
                    // I do that here so that this is included in execution time
                    if (this.toRecycle) {
                        this.vertexJunkyard = this.vertexJunkyard.concat(this.toRecycle.vertices);
                        this.edgeJunkyard = this.edgeJunkyard.concat(this.toRecycle.edges);
                        this.cellJunkyard = this.cellJunkyard.concat(this.toRecycle.cells);
                        this.toRecycle = null;
                    }

                    // Initialize site event queue
                    var siteEvents = sites.slice(0);
                    siteEvents.sort(function (a, b) {
                        var r = b.y - a.y;
                        if (r) {
                            return r;
                        }
                        return b.x - a.x;
                    });

                    // process queue
                    var site = siteEvents.pop(),
                            siteid = 0,
                            xsitex, // to avoid duplicate sites
                            xsitey,
                            cells = this.cells,
                            circle;

                    // main loop
                    for (; ; ) {
                        // we need to figure whether we handle a site or circle event
                        // for this we find out if there is a site event and it is
                        // 'earlier' than the circle event
                        circle = this.firstCircleEvent;

                        // add beach section
                        if (site && (!circle || site.y < circle.y || (site.y === circle.y && site.x < circle.x))) {
                            // only if site is not a duplicate
                            if (site.x !== xsitex || site.y !== xsitey) {
                                // first create cell for new site
                                cells[siteid] = this.createCell(site);
                                site.voronoiId = siteid++;
                                // then create a beachsection for that site
                                this.addBeachsection(site);
                                // remember last site coords to detect duplicate
                                xsitey = site.y;
                                xsitex = site.x;
                            }
                            site = siteEvents.pop();
                        }

                        // remove beach section
                        else if (circle) {
                            this.removeBeachsection(circle.arc);
                        }

                        // all done, quit
                        else {
                            break;
                        }
                    }

                    // wrapping-up:
                    //   connect dangling edges to bounding box
                    //   cut edges as per bounding box
                    //   discard edges completely outside bounding box
                    //   discard edges which are point-like
                    this.clipEdges(bbox);

                    //   add missing edges in order to close opened cells
                    this.closeCells(bbox);

                    // to measure execution time
                    var stopTime = new Date();

                    // prepare return values
                    var diagram = new this.Diagram();
                    diagram.cells = this.cells;
                    diagram.edges = this.edges;
                    diagram.vertices = this.vertices;
                    diagram.execTime = stopTime.getTime() - startTime.getTime();

                    // clean up
                    this.reset();

                    return diagram;
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
                /*
                 * SECOND STEP: Tiding up of the graph.
                 *
                 * We use the method described by Gansner and North, based on Voronoi
                 * diagrams.
                 *
                 * Ref: doi:10.1007/3-540-37623-2_28
                 */

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
                    var inarray=[];
                dataVertices.forEach(function(node){
                        inarray.push(node.id);
                    });
                for (var i = 0; i < fv.length; ++i) {
                       inarray.forEach(
                            function(idnode){
                                if(idnode==fv[i].label)
                                {
                                     pData['vertices'].push({id: fv[i].label, x: fv[i].x, y: fv[i].y});
                            }
                        });   
                            
                }

                return pData;


            }),
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

                /*global Math */

// ---------------------------------------------------------------------------

                function Voronoi() {
                    this.vertices = null;
                    this.edges = null;
                    this.cells = null;
                    this.toRecycle = null;
                    this.beachsectionJunkyard = [];
                    this.circleEventJunkyard = [];
                    this.vertexJunkyard = [];
                    this.edgeJunkyard = [];
                    this.cellJunkyard = [];
                }

// ---------------------------------------------------------------------------

                Voronoi.prototype.reset = function () {
                    if (!this.beachline) {
                        this.beachline = new this.RBTree();
                    }
                    // Move leftover beachsections to the beachsection junkyard.
                    if (this.beachline.root) {
                        var beachsection = this.beachline.getFirst(this.beachline.root);
                        while (beachsection) {
                            this.beachsectionJunkyard.push(beachsection); // mark for reuse
                            beachsection = beachsection.rbNext;
                        }
                    }
                    this.beachline.root = null;
                    if (!this.circleEvents) {
                        this.circleEvents = new this.RBTree();
                    }
                    this.circleEvents.root = this.firstCircleEvent = null;
                    this.vertices = [];
                    this.edges = [];
                    this.cells = [];
                };

                Voronoi.prototype.sqrt = Math.sqrt;
                Voronoi.prototype.abs = Math.abs;
                Voronoi.prototype.ε = Voronoi.ε = 1e-9;
                Voronoi.prototype.invε = Voronoi.invε = 1.0 / Voronoi.ε;
                Voronoi.prototype.equalWithEpsilon = function (a, b) {
                    return this.abs(a - b) < 1e-9;
                };
                Voronoi.prototype.greaterThanWithEpsilon = function (a, b) {
                    return a - b > 1e-9;
                };
                Voronoi.prototype.greaterThanOrEqualWithEpsilon = function (a, b) {
                    return b - a < 1e-9;
                };
                Voronoi.prototype.lessThanWithEpsilon = function (a, b) {
                    return b - a > 1e-9;
                };
                Voronoi.prototype.lessThanOrEqualWithEpsilon = function (a, b) {
                    return a - b < 1e-9;
                };

// ---------------------------------------------------------------------------
// Red-Black tree code (based on C version of "rbtree" by Franck Bui-Huu
// https://github.com/fbuihuu/libtree/blob/master/rb.c

                Voronoi.prototype.RBTree = function () {
                    this.root = null;
                };

                Voronoi.prototype.RBTree.prototype.rbInsertSuccessor = function (node, successor) {
                    var parent;
                    if (node) {
                        // >>> rhill 2011-05-27: Performance: cache previous/next nodes
                        successor.rbPrevious = node;
                        successor.rbNext = node.rbNext;
                        if (node.rbNext) {
                            node.rbNext.rbPrevious = successor;
                        }
                        node.rbNext = successor;
                        // <<<
                        if (node.rbRight) {
                            // in-place expansion of node.rbRight.getFirst();
                            node = node.rbRight;
                            while (node.rbLeft) {
                                node = node.rbLeft;
                            }
                            node.rbLeft = successor;
                        }
                        else {
                            node.rbRight = successor;
                        }
                        parent = node;
                    }
                    // rhill 2011-06-07: if node is null, successor must be inserted
                    // to the left-most part of the tree
                    else if (this.root) {
                        node = this.getFirst(this.root);
                        // >>> Performance: cache previous/next nodes
                        successor.rbPrevious = null;
                        successor.rbNext = node;
                        node.rbPrevious = successor;
                        // <<<
                        node.rbLeft = successor;
                        parent = node;
                    }
                    else {
                        // >>> Performance: cache previous/next nodes
                        successor.rbPrevious = successor.rbNext = null;
                        // <<<
                        this.root = successor;
                        parent = null;
                    }
                    successor.rbLeft = successor.rbRight = null;
                    successor.rbParent = parent;
                    successor.rbRed = true;
                    // Fixup the modified tree by recoloring nodes and performing
                    // rotations (2 at most) hence the red-black tree properties are
                    // preserved.
                    var grandpa, uncle;
                    node = successor;
                    while (parent && parent.rbRed) {
                        grandpa = parent.rbParent;
                        if (parent === grandpa.rbLeft) {
                            uncle = grandpa.rbRight;
                            if (uncle && uncle.rbRed) {
                                parent.rbRed = uncle.rbRed = false;
                                grandpa.rbRed = true;
                                node = grandpa;
                            }
                            else {
                                if (node === parent.rbRight) {
                                    this.rbRotateLeft(parent);
                                    node = parent;
                                    parent = node.rbParent;
                                }
                                parent.rbRed = false;
                                grandpa.rbRed = true;
                                this.rbRotateRight(grandpa);
                            }
                        }
                        else {
                            uncle = grandpa.rbLeft;
                            if (uncle && uncle.rbRed) {
                                parent.rbRed = uncle.rbRed = false;
                                grandpa.rbRed = true;
                                node = grandpa;
                            }
                            else {
                                if (node === parent.rbLeft) {
                                    this.rbRotateRight(parent);
                                    node = parent;
                                    parent = node.rbParent;
                                }
                                parent.rbRed = false;
                                grandpa.rbRed = true;
                                this.rbRotateLeft(grandpa);
                            }
                        }
                        parent = node.rbParent;
                    }
                    this.root.rbRed = false;
                };

                Voronoi.prototype.RBTree.prototype.rbRemoveNode = function (node) {
                    // >>> rhill 2011-05-27: Performance: cache previous/next nodes
                    if (node.rbNext) {
                        node.rbNext.rbPrevious = node.rbPrevious;
                    }
                    if (node.rbPrevious) {
                        node.rbPrevious.rbNext = node.rbNext;
                    }
                    node.rbNext = node.rbPrevious = null;
                    // <<<
                    var parent = node.rbParent,
                            left = node.rbLeft,
                            right = node.rbRight,
                            next;
                    if (!left) {
                        next = right;
                    }
                    else if (!right) {
                        next = left;
                    }
                    else {
                        next = this.getFirst(right);
                    }
                    if (parent) {
                        if (parent.rbLeft === node) {
                            parent.rbLeft = next;
                        }
                        else {
                            parent.rbRight = next;
                        }
                    }
                    else {
                        this.root = next;
                    }
                    // enforce red-black rules
                    var isRed;
                    if (left && right) {
                        isRed = next.rbRed;
                        next.rbRed = node.rbRed;
                        next.rbLeft = left;
                        left.rbParent = next;
                        if (next !== right) {
                            parent = next.rbParent;
                            next.rbParent = node.rbParent;
                            node = next.rbRight;
                            parent.rbLeft = node;
                            next.rbRight = right;
                            right.rbParent = next;
                        }
                        else {
                            next.rbParent = parent;
                            parent = next;
                            node = next.rbRight;
                        }
                    }
                    else {
                        isRed = node.rbRed;
                        node = next;
                    }
                    // 'node' is now the sole successor's child and 'parent' its
                    // new parent (since the successor can have been moved)
                    if (node) {
                        node.rbParent = parent;
                    }
                    // the 'easy' cases
                    if (isRed) {
                        return;
                    }
                    if (node && node.rbRed) {
                        node.rbRed = false;
                        return;
                    }
                    // the other cases
                    var sibling;
                    do {
                        if (node === this.root) {
                            break;
                        }
                        if (node === parent.rbLeft) {
                            sibling = parent.rbRight;
                            if (sibling.rbRed) {
                                sibling.rbRed = false;
                                parent.rbRed = true;
                                this.rbRotateLeft(parent);
                                sibling = parent.rbRight;
                            }
                            if ((sibling.rbLeft && sibling.rbLeft.rbRed) || (sibling.rbRight && sibling.rbRight.rbRed)) {
                                if (!sibling.rbRight || !sibling.rbRight.rbRed) {
                                    sibling.rbLeft.rbRed = false;
                                    sibling.rbRed = true;
                                    this.rbRotateRight(sibling);
                                    sibling = parent.rbRight;
                                }
                                sibling.rbRed = parent.rbRed;
                                parent.rbRed = sibling.rbRight.rbRed = false;
                                this.rbRotateLeft(parent);
                                node = this.root;
                                break;
                            }
                        }
                        else {
                            sibling = parent.rbLeft;
                            if (sibling.rbRed) {
                                sibling.rbRed = false;
                                parent.rbRed = true;
                                this.rbRotateRight(parent);
                                sibling = parent.rbLeft;
                            }
                            if ((sibling.rbLeft && sibling.rbLeft.rbRed) || (sibling.rbRight && sibling.rbRight.rbRed)) {
                                if (!sibling.rbLeft || !sibling.rbLeft.rbRed) {
                                    sibling.rbRight.rbRed = false;
                                    sibling.rbRed = true;
                                    this.rbRotateLeft(sibling);
                                    sibling = parent.rbLeft;
                                }
                                sibling.rbRed = parent.rbRed;
                                parent.rbRed = sibling.rbLeft.rbRed = false;
                                this.rbRotateRight(parent);
                                node = this.root;
                                break;
                            }
                        }
                        sibling.rbRed = true;
                        node = parent;
                        parent = parent.rbParent;
                    } while (!node.rbRed);
                    if (node) {
                        node.rbRed = false;
                    }
                };

                Voronoi.prototype.RBTree.prototype.rbRotateLeft = function (node) {
                    var p = node,
                            q = node.rbRight, // can't be null
                            parent = p.rbParent;
                    if (parent) {
                        if (parent.rbLeft === p) {
                            parent.rbLeft = q;
                        }
                        else {
                            parent.rbRight = q;
                        }
                    }
                    else {
                        this.root = q;
                    }
                    q.rbParent = parent;
                    p.rbParent = q;
                    p.rbRight = q.rbLeft;
                    if (p.rbRight) {
                        p.rbRight.rbParent = p;
                    }
                    q.rbLeft = p;
                };

                Voronoi.prototype.RBTree.prototype.rbRotateRight = function (node) {
                    var p = node,
                            q = node.rbLeft, // can't be null
                            parent = p.rbParent;
                    if (parent) {
                        if (parent.rbLeft === p) {
                            parent.rbLeft = q;
                        }
                        else {
                            parent.rbRight = q;
                        }
                    }
                    else {
                        this.root = q;
                    }
                    q.rbParent = parent;
                    p.rbParent = q;
                    p.rbLeft = q.rbRight;
                    if (p.rbLeft) {
                        p.rbLeft.rbParent = p;
                    }
                    q.rbRight = p;
                };

                Voronoi.prototype.RBTree.prototype.getFirst = function (node) {
                    while (node.rbLeft) {
                        node = node.rbLeft;
                    }
                    return node;
                };

                Voronoi.prototype.RBTree.prototype.getLast = function (node) {
                    while (node.rbRight) {
                        node = node.rbRight;
                    }
                    return node;
                };

// ---------------------------------------------------------------------------
// Diagram methods

                Voronoi.prototype.Diagram = function (site) {
                    this.site = site;
                };

// ---------------------------------------------------------------------------
// Cell methods

                Voronoi.prototype.Cell = function (site) {
                    this.site = site;
                    this.halfedges = [];
                    this.closeMe = false;
                };

                Voronoi.prototype.Cell.prototype.init = function (site) {
                    this.site = site;
                    this.halfedges = [];
                    this.closeMe = false;
                    return this;
                };

                Voronoi.prototype.createCell = function (site) {
                    var cell = this.cellJunkyard.pop();
                    if (cell) {
                        return cell.init(site);
                    }
                    return new this.Cell(site);
                };

                Voronoi.prototype.Cell.prototype.prepareHalfedges = function () {
                    var halfedges = this.halfedges,
                            iHalfedge = halfedges.length,
                            edge;
                    // get rid of unused halfedges
                    // rhill 2011-05-27: Keep it simple, no point here in trying
                    // to be fancy: dangling edges are a typically a minority.
                    while (iHalfedge--) {
                        edge = halfedges[iHalfedge].edge;
                        if (!edge.vb || !edge.va) {
                            halfedges.splice(iHalfedge, 1);
                        }
                    }

                    // rhill 2011-05-26: I tried to use a binary search at insertion
                    // time to keep the array sorted on-the-fly (in Cell.addHalfedge()).
                    // There was no real benefits in doing so, performance on
                    // Firefox 3.6 was improved marginally, while performance on
                    // Opera 11 was penalized marginally.
                    halfedges.sort(function (a, b) {
                        return b.angle - a.angle;
                    });
                    return halfedges.length;
                };

// Return a list of the neighbor Ids
                Voronoi.prototype.Cell.prototype.getNeighborIds = function () {
                    var neighbors = [],
                            iHalfedge = this.halfedges.length,
                            edge;
                    while (iHalfedge--) {
                        edge = this.halfedges[iHalfedge].edge;
                        if (edge.lSite !== null && edge.lSite.voronoiId != this.site.voronoiId) {
                            neighbors.push(edge.lSite.voronoiId);
                        }
                        else if (edge.rSite !== null && edge.rSite.voronoiId != this.site.voronoiId) {
                            neighbors.push(edge.rSite.voronoiId);
                        }
                    }
                    return neighbors;
                };

// Compute bounding box
//
                Voronoi.prototype.Cell.prototype.getBbox = function () {
                    var halfedges = this.halfedges,
                            iHalfedge = halfedges.length,
                            xmin = Infinity,
                            ymin = Infinity,
                            xmax = -Infinity,
                            ymax = -Infinity,
                            v, vx, vy;
                    while (iHalfedge--) {
                        v = halfedges[iHalfedge].getStartpoint();
                        vx = v.x;
                        vy = v.y;
                        if (vx < xmin) {
                            xmin = vx;
                        }
                        if (vy < ymin) {
                            ymin = vy;
                        }
                        if (vx > xmax) {
                            xmax = vx;
                        }
                        if (vy > ymax) {
                            ymax = vy;
                        }
                        // we dont need to take into account end point,
                        // since each end point matches a start point
                    }
                    return {
                        x: xmin,
                        y: ymin,
                        width: xmax - xmin,
                        height: ymax - ymin
                    };
                };

// Return whether a point is inside, on, or outside the cell:
//   -1: point is outside the perimeter of the cell
//    0: point is on the perimeter of the cell
//    1: point is inside the perimeter of the cell
//
                Voronoi.prototype.Cell.prototype.pointIntersection = function (x, y) {
                    // Check if point in polygon. Since all polygons of a Voronoi
                    // diagram are convex, then:
                    // http://paulbourke.net/geometry/polygonmesh/
                    // Solution 3 (2D):
                    //   "If the polygon is convex then one can consider the polygon
                    //   "as a 'path' from the first vertex. A point is on the interior
                    //   "of this polygons if it is always on the same side of all the
                    //   "line segments making up the path. ...
                    //   "(y - y0) (x1 - x0) - (x - x0) (y1 - y0)
                    //   "if it is less than 0 then P is to the right of the line segment,
                    //   "if greater than 0 it is to the left, if equal to 0 then it lies
                    //   "on the line segment"
                    var halfedges = this.halfedges,
                            iHalfedge = halfedges.length,
                            halfedge,
                            p0, p1, r;
                    while (iHalfedge--) {
                        halfedge = halfedges[iHalfedge];
                        p0 = halfedge.getStartpoint();
                        p1 = halfedge.getEndpoint();
                        r = (y - p0.y) * (p1.x - p0.x) - (x - p0.x) * (p1.y - p0.y);
                        if (!r) {
                            return 0;
                        }
                        if (r > 0) {
                            return -1;
                        }
                    }
                    return 1;
                };

// ---------------------------------------------------------------------------
// Edge methods
//

                Voronoi.prototype.Vertex = function (x, y) {
                    this.x = x;
                    this.y = y;
                };

                Voronoi.prototype.Edge = function (lSite, rSite) {
                    this.lSite = lSite;
                    this.rSite = rSite;
                    this.va = this.vb = null;
                };

                Voronoi.prototype.Halfedge = function (edge, lSite, rSite) {
                    this.site = lSite;
                    this.edge = edge;
                    // 'angle' is a value to be used for properly sorting the
                    // halfsegments counterclockwise. By convention, we will
                    // use the angle of the line defined by the 'site to the left'
                    // to the 'site to the right'.
                    // However, border edges have no 'site to the right': thus we
                    // use the angle of line perpendicular to the halfsegment (the
                    // edge should have both end points defined in such case.)
                    if (rSite) {
                        this.angle = Math.atan2(rSite.y - lSite.y, rSite.x - lSite.x);
                    }
                    else {
                        var va = edge.va,
                                vb = edge.vb;
                        // rhill 2011-05-31: used to call getStartpoint()/getEndpoint(),
                        // but for performance purpose, these are expanded in place here.
                        this.angle = edge.lSite === lSite ?
                                Math.atan2(vb.x - va.x, va.y - vb.y) :
                                Math.atan2(va.x - vb.x, vb.y - va.y);
                    }
                };

                Voronoi.prototype.createHalfedge = function (edge, lSite, rSite) {
                    return new this.Halfedge(edge, lSite, rSite);
                };

                Voronoi.prototype.Halfedge.prototype.getStartpoint = function () {
                    return this.edge.lSite === this.site ? this.edge.va : this.edge.vb;
                };

                Voronoi.prototype.Halfedge.prototype.getEndpoint = function () {
                    return this.edge.lSite === this.site ? this.edge.vb : this.edge.va;
                };



// this create and add a vertex to the internal collection

                Voronoi.prototype.createVertex = function (x, y) {
                    var v = this.vertexJunkyard.pop();
                    if (!v) {
                        v = new this.Vertex(x, y);
                    }
                    else {
                        v.x = x;
                        v.y = y;
                    }
                    this.vertices.push(v);
                    return v;
                };

// this create and add an edge to internal collection, and also create
// two halfedges which are added to each site's counterclockwise array
// of halfedges.

                Voronoi.prototype.createEdge = function (lSite, rSite, va, vb) {
                    var edge = this.edgeJunkyard.pop();
                    if (!edge) {
                        edge = new this.Edge(lSite, rSite);
                    }
                    else {
                        edge.lSite = lSite;
                        edge.rSite = rSite;
                        edge.va = edge.vb = null;
                    }

                    this.edges.push(edge);
                    if (va) {
                        this.setEdgeStartpoint(edge, lSite, rSite, va);
                    }
                    if (vb) {
                        this.setEdgeEndpoint(edge, lSite, rSite, vb);
                    }
                    this.cells[lSite.voronoiId].halfedges.push(this.createHalfedge(edge, lSite, rSite));
                    this.cells[rSite.voronoiId].halfedges.push(this.createHalfedge(edge, rSite, lSite));
                    return edge;
                };

                Voronoi.prototype.createBorderEdge = function (lSite, va, vb) {
                    var edge = this.edgeJunkyard.pop();
                    if (!edge) {
                        edge = new this.Edge(lSite, null);
                    }
                    else {
                        edge.lSite = lSite;
                        edge.rSite = null;
                    }
                    edge.va = va;
                    edge.vb = vb;
                    this.edges.push(edge);
                    return edge;
                };

                Voronoi.prototype.setEdgeStartpoint = function (edge, lSite, rSite, vertex) {
                    if (!edge.va && !edge.vb) {
                        edge.va = vertex;
                        edge.lSite = lSite;
                        edge.rSite = rSite;
                    }
                    else if (edge.lSite === rSite) {
                        edge.vb = vertex;
                    }
                    else {
                        edge.va = vertex;
                    }
                };

                Voronoi.prototype.setEdgeEndpoint = function (edge, lSite, rSite, vertex) {
                    this.setEdgeStartpoint(edge, rSite, lSite, vertex);
                };

// ---------------------------------------------------------------------------
// Beachline methods

// rhill 2011-06-07: For some reasons, performance suffers significantly
// when instanciating a literal object instead of an empty ctor
                Voronoi.prototype.Beachsection = function () {
                };

// rhill 2011-06-02: A lot of Beachsection instanciations
// occur during the computation of the Voronoi diagram,
// somewhere between the number of sites and twice the
// number of sites, while the number of Beachsections on the
// beachline at any given time is comparatively low. For this
// reason, we reuse already created Beachsections, in order
// to avoid new memory allocation. This resulted in a measurable
// performance gain.

                Voronoi.prototype.createBeachsection = function (site) {
                    var beachsection = this.beachsectionJunkyard.pop();
                    if (!beachsection) {
                        beachsection = new this.Beachsection();
                    }
                    beachsection.site = site;
                    return beachsection;
                };

// calculate the left break point of a particular beach section,
// given a particular sweep line
                Voronoi.prototype.leftBreakPoint = function (arc, directrix) {
                    // http://en.wikipedia.org/wiki/Parabola
                    // http://en.wikipedia.org/wiki/Quadratic_equation
                    // h1 = x1,
                    // k1 = (y1+directrix)/2,
                    // h2 = x2,
                    // k2 = (y2+directrix)/2,
                    // p1 = k1-directrix,
                    // a1 = 1/(4*p1),
                    // b1 = -h1/(2*p1),
                    // c1 = h1*h1/(4*p1)+k1,
                    // p2 = k2-directrix,
                    // a2 = 1/(4*p2),
                    // b2 = -h2/(2*p2),
                    // c2 = h2*h2/(4*p2)+k2,
                    // x = (-(b2-b1) + Math.sqrt((b2-b1)*(b2-b1) - 4*(a2-a1)*(c2-c1))) / (2*(a2-a1))
                    // When x1 become the x-origin:
                    // h1 = 0,
                    // k1 = (y1+directrix)/2,
                    // h2 = x2-x1,
                    // k2 = (y2+directrix)/2,
                    // p1 = k1-directrix,
                    // a1 = 1/(4*p1),
                    // b1 = 0,
                    // c1 = k1,
                    // p2 = k2-directrix,
                    // a2 = 1/(4*p2),
                    // b2 = -h2/(2*p2),
                    // c2 = h2*h2/(4*p2)+k2,
                    // x = (-b2 + Math.sqrt(b2*b2 - 4*(a2-a1)*(c2-k1))) / (2*(a2-a1)) + x1

                    // change code below at your own risk: care has been taken to
                    // reduce errors due to computers' finite arithmetic precision.
                    // Maybe can still be improved, will see if any more of this
                    // kind of errors pop up again.
                    var site = arc.site,
                            rfocx = site.x,
                            rfocy = site.y,
                            pby2 = rfocy - directrix;
                    // parabola in degenerate case where focus is on directrix
                    if (!pby2) {
                        return rfocx;
                    }
                    var lArc = arc.rbPrevious;
                    if (!lArc) {
                        return -Infinity;
                    }
                    site = lArc.site;
                    var lfocx = site.x,
                            lfocy = site.y,
                            plby2 = lfocy - directrix;
                    // parabola in degenerate case where focus is on directrix
                    if (!plby2) {
                        return lfocx;
                    }
                    var hl = lfocx - rfocx,
                            aby2 = 1 / pby2 - 1 / plby2,
                            b = hl / plby2;
                    if (aby2) {
                        return (-b + this.sqrt(b * b - 2 * aby2 * (hl * hl / (-2 * plby2) - lfocy + plby2 / 2 + rfocy - pby2 / 2))) / aby2 + rfocx;
                    }
                    // both parabolas have same distance to directrix, thus break point is midway
                    return (rfocx + lfocx) / 2;
                };

// calculate the right break point of a particular beach section,
// given a particular directrix
                Voronoi.prototype.rightBreakPoint = function (arc, directrix) {
                    var rArc = arc.rbNext;
                    if (rArc) {
                        return this.leftBreakPoint(rArc, directrix);
                    }
                    var site = arc.site;
                    return site.y === directrix ? site.x : Infinity;
                };

                Voronoi.prototype.detachBeachsection = function (beachsection) {
                    this.detachCircleEvent(beachsection); // detach potentially attached circle event
                    this.beachline.rbRemoveNode(beachsection); // remove from RB-tree
                    this.beachsectionJunkyard.push(beachsection); // mark for reuse
                };

                Voronoi.prototype.removeBeachsection = function (beachsection) {
                    var circle = beachsection.circleEvent,
                            x = circle.x,
                            y = circle.ycenter,
                            vertex = this.createVertex(x, y),
                            previous = beachsection.rbPrevious,
                            next = beachsection.rbNext,
                            disappearingTransitions = [beachsection],
                            abs_fn = Math.abs;

                    // remove collapsed beachsection from beachline
                    this.detachBeachsection(beachsection);

                    // there could be more than one empty arc at the deletion point, this
                    // happens when more than two edges are linked by the same vertex,
                    // so we will collect all those edges by looking up both sides of
                    // the deletion point.
                    // by the way, there is *always* a predecessor/successor to any collapsed
                    // beach section, it's just impossible to have a collapsing first/last
                    // beach sections on the beachline, since they obviously are unconstrained
                    // on their left/right side.

                    // look left
                    var lArc = previous;
                    while (lArc.circleEvent && abs_fn(x - lArc.circleEvent.x) < 1e-9 && abs_fn(y - lArc.circleEvent.ycenter) < 1e-9) {
                        previous = lArc.rbPrevious;
                        disappearingTransitions.unshift(lArc);
                        this.detachBeachsection(lArc); // mark for reuse
                        lArc = previous;
                    }
                    // even though it is not disappearing, I will also add the beach section
                    // immediately to the left of the left-most collapsed beach section, for
                    // convenience, since we need to refer to it later as this beach section
                    // is the 'left' site of an edge for which a start point is set.
                    disappearingTransitions.unshift(lArc);
                    this.detachCircleEvent(lArc);

                    // look right
                    var rArc = next;
                    while (rArc.circleEvent && abs_fn(x - rArc.circleEvent.x) < 1e-9 && abs_fn(y - rArc.circleEvent.ycenter) < 1e-9) {
                        next = rArc.rbNext;
                        disappearingTransitions.push(rArc);
                        this.detachBeachsection(rArc); // mark for reuse
                        rArc = next;
                    }
                    // we also have to add the beach section immediately to the right of the
                    // right-most collapsed beach section, since there is also a disappearing
                    // transition representing an edge's start point on its left.
                    disappearingTransitions.push(rArc);
                    this.detachCircleEvent(rArc);

                    // walk through all the disappearing transitions between beach sections and
                    // set the start point of their (implied) edge.
                    var nArcs = disappearingTransitions.length,
                            iArc;
                    for (iArc = 1; iArc < nArcs; iArc++) {
                        rArc = disappearingTransitions[iArc];
                        lArc = disappearingTransitions[iArc - 1];
                        this.setEdgeStartpoint(rArc.edge, lArc.site, rArc.site, vertex);
                    }

                    // create a new edge as we have now a new transition between
                    // two beach sections which were previously not adjacent.
                    // since this edge appears as a new vertex is defined, the vertex
                    // actually define an end point of the edge (relative to the site
                    // on the left)
                    lArc = disappearingTransitions[0];
                    rArc = disappearingTransitions[nArcs - 1];
                    rArc.edge = this.createEdge(lArc.site, rArc.site, undefined, vertex);

                    // create circle events if any for beach sections left in the beachline
                    // adjacent to collapsed sections
                    this.attachCircleEvent(lArc);
                    this.attachCircleEvent(rArc);
                };

                Voronoi.prototype.addBeachsection = function (site) {
                    var x = site.x,
                            directrix = site.y;

                    // find the left and right beach sections which will surround the newly
                    // created beach section.
                    // rhill 2011-06-01: This loop is one of the most often executed,
                    // hence we expand in-place the comparison-against-epsilon calls.
                    var lArc, rArc,
                            dxl, dxr,
                            node = this.beachline.root;

                    while (node) {
                        dxl = this.leftBreakPoint(node, directrix) - x;
                        // x lessThanWithEpsilon xl => falls somewhere before the left edge of the beachsection
                        if (dxl > 1e-9) {
                            // this case should never happen
                            // if (!node.rbLeft) {
                            //    rArc = node.rbLeft;
                            //    break;
                            //    }
                            node = node.rbLeft;
                        }
                        else {
                            dxr = x - this.rightBreakPoint(node, directrix);
                            // x greaterThanWithEpsilon xr => falls somewhere after the right edge of the beachsection
                            if (dxr > 1e-9) {
                                if (!node.rbRight) {
                                    lArc = node;
                                    break;
                                }
                                node = node.rbRight;
                            }
                            else {
                                // x equalWithEpsilon xl => falls exactly on the left edge of the beachsection
                                if (dxl > -1e-9) {
                                    lArc = node.rbPrevious;
                                    rArc = node;
                                }
                                // x equalWithEpsilon xr => falls exactly on the right edge of the beachsection
                                else if (dxr > -1e-9) {
                                    lArc = node;
                                    rArc = node.rbNext;
                                }
                                // falls exactly somewhere in the middle of the beachsection
                                else {
                                    lArc = rArc = node;
                                }
                                break;
                            }
                        }
                    }
                    // at this point, keep in mind that lArc and/or rArc could be
                    // undefined or null.

                    // create a new beach section object for the site and add it to RB-tree
                    var newArc = this.createBeachsection(site);
                    this.beachline.rbInsertSuccessor(lArc, newArc);

                    // cases:
                    //

                    // [null,null]
                    // least likely case: new beach section is the first beach section on the
                    // beachline.
                    // This case means:
                    //   no new transition appears
                    //   no collapsing beach section
                    //   new beachsection become root of the RB-tree
                    if (!lArc && !rArc) {
                        return;
                    }

                    // [lArc,rArc] where lArc == rArc
                    // most likely case: new beach section split an existing beach
                    // section.
                    // This case means:
                    //   one new transition appears
                    //   the left and right beach section might be collapsing as a result
                    //   two new nodes added to the RB-tree
                    if (lArc === rArc) {
                        // invalidate circle event of split beach section
                        this.detachCircleEvent(lArc);

                        // split the beach section into two separate beach sections
                        rArc = this.createBeachsection(lArc.site);
                        this.beachline.rbInsertSuccessor(newArc, rArc);

                        // since we have a new transition between two beach sections,
                        // a new edge is born
                        newArc.edge = rArc.edge = this.createEdge(lArc.site, newArc.site);

                        // check whether the left and right beach sections are collapsing
                        // and if so create circle events, to be notified when the point of
                        // collapse is reached.
                        this.attachCircleEvent(lArc);
                        this.attachCircleEvent(rArc);
                        return;
                    }

                    // [lArc,null]
                    // even less likely case: new beach section is the *last* beach section
                    // on the beachline -- this can happen *only* if *all* the previous beach
                    // sections currently on the beachline share the same y value as
                    // the new beach section.
                    // This case means:
                    //   one new transition appears
                    //   no collapsing beach section as a result
                    //   new beach section become right-most node of the RB-tree
                    if (lArc && !rArc) {
                        newArc.edge = this.createEdge(lArc.site, newArc.site);
                        return;
                    }

                    // [null,rArc]
                    // impossible case: because sites are strictly processed from top to bottom,
                    // and left to right, which guarantees that there will always be a beach section
                    // on the left -- except of course when there are no beach section at all on
                    // the beach line, which case was handled above.
                    // rhill 2011-06-02: No point testing in non-debug version
                    //if (!lArc && rArc) {
                    //    throw "Voronoi.addBeachsection(): What is this I don't even";
                    //    }

                    // [lArc,rArc] where lArc != rArc
                    // somewhat less likely case: new beach section falls *exactly* in between two
                    // existing beach sections
                    // This case means:
                    //   one transition disappears
                    //   two new transitions appear
                    //   the left and right beach section might be collapsing as a result
                    //   only one new node added to the RB-tree
                    if (lArc !== rArc) {
                        // invalidate circle events of left and right sites
                        this.detachCircleEvent(lArc);
                        this.detachCircleEvent(rArc);

                        // an existing transition disappears, meaning a vertex is defined at
                        // the disappearance point.
                        // since the disappearance is caused by the new beachsection, the
                        // vertex is at the center of the circumscribed circle of the left,
                        // new and right beachsections.
                        // http://mathforum.org/library/drmath/view/55002.html
                        // Except that I bring the origin at A to simplify
                        // calculation
                        var lSite = lArc.site,
                                ax = lSite.x,
                                ay = lSite.y,
                                bx = site.x - ax,
                                by = site.y - ay,
                                rSite = rArc.site,
                                cx = rSite.x - ax,
                                cy = rSite.y - ay,
                                d = 2 * (bx * cy - by * cx),
                                hb = bx * bx + by * by,
                                hc = cx * cx + cy * cy,
                                vertex = this.createVertex((cy * hb - by * hc) / d + ax, (bx * hc - cx * hb) / d + ay);

                        // one transition disappear
                        this.setEdgeStartpoint(rArc.edge, lSite, rSite, vertex);

                        // two new transitions appear at the new vertex location
                        newArc.edge = this.createEdge(lSite, site, undefined, vertex);
                        rArc.edge = this.createEdge(site, rSite, undefined, vertex);

                        // check whether the left and right beach sections are collapsing
                        // and if so create circle events, to handle the point of collapse.
                        this.attachCircleEvent(lArc);
                        this.attachCircleEvent(rArc);
                        return;
                    }
                };

// ---------------------------------------------------------------------------
// Circle event methods

// rhill 2011-06-07: For some reasons, performance suffers significantly
// when instanciating a literal object instead of an empty ctor
                Voronoi.prototype.CircleEvent = function () {
                    // rhill 2013-10-12: it helps to state exactly what we are at ctor time.
                    this.arc = null;
                    this.rbLeft = null;
                    this.rbNext = null;
                    this.rbParent = null;
                    this.rbPrevious = null;
                    this.rbRed = false;
                    this.rbRight = null;
                    this.site = null;
                    this.x = this.y = this.ycenter = 0;
                };

                Voronoi.prototype.attachCircleEvent = function (arc) {
                    var lArc = arc.rbPrevious,
                            rArc = arc.rbNext;
                    if (!lArc || !rArc) {
                        return;
                    } // does that ever happen?
                    var lSite = lArc.site,
                            cSite = arc.site,
                            rSite = rArc.site;

                    // If site of left beachsection is same as site of
                    // right beachsection, there can't be convergence
                    if (lSite === rSite) {
                        return;
                    }

                    // Find the circumscribed circle for the three sites associated
                    // with the beachsection triplet.
                    // rhill 2011-05-26: It is more efficient to calculate in-place
                    // rather than getting the resulting circumscribed circle from an
                    // object returned by calling Voronoi.circumcircle()
                    // http://mathforum.org/library/drmath/view/55002.html
                    // Except that I bring the origin at cSite to simplify calculations.
                    // The bottom-most part of the circumcircle is our Fortune 'circle
                    // event', and its center is a vertex potentially part of the final
                    // Voronoi diagram.
                    var bx = cSite.x,
                            by = cSite.y,
                            ax = lSite.x - bx,
                            ay = lSite.y - by,
                            cx = rSite.x - bx,
                            cy = rSite.y - by;

                    // If points l->c->r are clockwise, then center beach section does not
                    // collapse, hence it can't end up as a vertex (we reuse 'd' here, which
                    // sign is reverse of the orientation, hence we reverse the test.
                    // http://en.wikipedia.org/wiki/Curve_orientation#Orientation_of_a_simple_polygon
                    // rhill 2011-05-21: Nasty finite precision error which caused circumcircle() to
                    // return infinites: 1e-12 seems to fix the problem.
                    var d = 2 * (ax * cy - ay * cx);
                    if (d >= -2e-12) {
                        return;
                    }

                    var ha = ax * ax + ay * ay,
                            hc = cx * cx + cy * cy,
                            x = (cy * ha - ay * hc) / d,
                            y = (ax * hc - cx * ha) / d,
                            ycenter = y + by;

                    // Important: ybottom should always be under or at sweep, so no need
                    // to waste CPU cycles by checking

                    // recycle circle event object if possible
                    var circleEvent = this.circleEventJunkyard.pop();
                    if (!circleEvent) {
                        circleEvent = new this.CircleEvent();
                    }
                    circleEvent.arc = arc;
                    circleEvent.site = cSite;
                    circleEvent.x = x + bx;
                    circleEvent.y = ycenter + this.sqrt(x * x + y * y); // y bottom
                    circleEvent.ycenter = ycenter;
                    arc.circleEvent = circleEvent;

                    // find insertion point in RB-tree: circle events are ordered from
                    // smallest to largest
                    var predecessor = null,
                            node = this.circleEvents.root;
                    while (node) {
                        if (circleEvent.y < node.y || (circleEvent.y === node.y && circleEvent.x <= node.x)) {
                            if (node.rbLeft) {
                                node = node.rbLeft;
                            }
                            else {
                                predecessor = node.rbPrevious;
                                break;
                            }
                        }
                        else {
                            if (node.rbRight) {
                                node = node.rbRight;
                            }
                            else {
                                predecessor = node;
                                break;
                            }
                        }
                    }
                    this.circleEvents.rbInsertSuccessor(predecessor, circleEvent);
                    if (!predecessor) {
                        this.firstCircleEvent = circleEvent;
                    }
                };

                Voronoi.prototype.detachCircleEvent = function (arc) {
                    var circleEvent = arc.circleEvent;
                    if (circleEvent) {
                        if (!circleEvent.rbPrevious) {
                            this.firstCircleEvent = circleEvent.rbNext;
                        }
                        this.circleEvents.rbRemoveNode(circleEvent); // remove from RB-tree
                        this.circleEventJunkyard.push(circleEvent);
                        arc.circleEvent = null;
                    }
                };

// ---------------------------------------------------------------------------
// Diagram completion methods

// connect dangling edges (not if a cursory test tells us
// it is not going to be visible.
// return value:
//   false: the dangling endpoint couldn't be connected
//   true: the dangling endpoint could be connected
                Voronoi.prototype.connectEdge = function (edge, bbox) {
                    // skip if end point already connected
                    var vb = edge.vb;
                    if (!!vb) {
                        return true;
                    }

                    // make local copy for performance purpose
                    var va = edge.va,
                            xl = bbox.xl,
                            xr = bbox.xr,
                            yt = bbox.yt,
                            yb = bbox.yb,
                            lSite = edge.lSite,
                            rSite = edge.rSite,
                            lx = lSite.x,
                            ly = lSite.y,
                            rx = rSite.x,
                            ry = rSite.y,
                            fx = (lx + rx) / 2,
                            fy = (ly + ry) / 2,
                            fm, fb;

                    // if we reach here, this means cells which use this edge will need
                    // to be closed, whether because the edge was removed, or because it
                    // was connected to the bounding box.
                    this.cells[lSite.voronoiId].closeMe = true;
                    this.cells[rSite.voronoiId].closeMe = true;

                    // get the line equation of the bisector if line is not vertical
                    if (ry !== ly) {
                        fm = (lx - rx) / (ry - ly);
                        fb = fy - fm * fx;
                    }

                    // remember, direction of line (relative to left site):
                    // upward: left.x < right.x
                    // downward: left.x > right.x
                    // horizontal: left.x == right.x
                    // upward: left.x < right.x
                    // rightward: left.y < right.y
                    // leftward: left.y > right.y
                    // vertical: left.y == right.y

                    // depending on the direction, find the best side of the
                    // bounding box to use to determine a reasonable start point

                    // rhill 2013-12-02:
                    // While at it, since we have the values which define the line,
                    // clip the end of va if it is outside the bbox.
                    // https://github.com/gorhill/Javascript-Voronoi/issues/15
                    // TODO: Do all the clipping here rather than rely on Liang-Barsky
                    // which does not do well sometimes due to loss of arithmetic
                    // precision. The code here doesn't degrade if one of the vertex is
                    // at a huge distance.

                    // special case: vertical line
                    if (fm === undefined) {
                        // doesn't intersect with viewport
                        if (fx < xl || fx >= xr) {
                            return false;
                        }
                        // downward
                        if (lx > rx) {
                            if (!va || va.y < yt) {
                                va = this.createVertex(fx, yt);
                            }
                            else if (va.y >= yb) {
                                return false;
                            }
                            vb = this.createVertex(fx, yb);
                        }
                        // upward
                        else {
                            if (!va || va.y > yb) {
                                va = this.createVertex(fx, yb);
                            }
                            else if (va.y < yt) {
                                return false;
                            }
                            vb = this.createVertex(fx, yt);
                        }
                    }
                    // closer to vertical than horizontal, connect start point to the
                    // top or bottom side of the bounding box
                    else if (fm < -1 || fm > 1) {
                        // downward
                        if (lx > rx) {
                            if (!va || va.y < yt) {
                                va = this.createVertex((yt - fb) / fm, yt);
                            }
                            else if (va.y >= yb) {
                                return false;
                            }
                            vb = this.createVertex((yb - fb) / fm, yb);
                        }
                        // upward
                        else {
                            if (!va || va.y > yb) {
                                va = this.createVertex((yb - fb) / fm, yb);
                            }
                            else if (va.y < yt) {
                                return false;
                            }
                            vb = this.createVertex((yt - fb) / fm, yt);
                        }
                    }
                    // closer to horizontal than vertical, connect start point to the
                    // left or right side of the bounding box
                    else {
                        // rightward
                        if (ly < ry) {
                            if (!va || va.x < xl) {
                                va = this.createVertex(xl, fm * xl + fb);
                            }
                            else if (va.x >= xr) {
                                return false;
                            }
                            vb = this.createVertex(xr, fm * xr + fb);
                        }
                        // leftward
                        else {
                            if (!va || va.x > xr) {
                                va = this.createVertex(xr, fm * xr + fb);
                            }
                            else if (va.x < xl) {
                                return false;
                            }
                            vb = this.createVertex(xl, fm * xl + fb);
                        }
                    }
                    edge.va = va;
                    edge.vb = vb;

                    return true;
                };

// line-clipping code taken from:
//   Liang-Barsky function by Daniel White
//   http://www.skytopia.com/project/articles/compsci/clipping.html
// Thanks!
// A bit modified to minimize code paths
                Voronoi.prototype.clipEdge = function (edge, bbox) {
                    var ax = edge.va.x,
                            ay = edge.va.y,
                            bx = edge.vb.x,
                            by = edge.vb.y,
                            t0 = 0,
                            t1 = 1,
                            dx = bx - ax,
                            dy = by - ay;
                    // left
                    var q = ax - bbox.xl;
                    if (dx === 0 && q < 0) {
                        return false;
                    }
                    var r = -q / dx;
                    if (dx < 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }
                    else if (dx > 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    // right
                    q = bbox.xr - ax;
                    if (dx === 0 && q < 0) {
                        return false;
                    }
                    r = q / dx;
                    if (dx < 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    else if (dx > 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }
                    // top
                    q = ay - bbox.yt;
                    if (dy === 0 && q < 0) {
                        return false;
                    }
                    r = -q / dy;
                    if (dy < 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }
                    else if (dy > 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    // bottom        
                    q = bbox.yb - ay;
                    if (dy === 0 && q < 0) {
                        return false;
                    }
                    r = q / dy;
                    if (dy < 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    else if (dy > 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }

                    // if we reach this point, Voronoi edge is within bbox

                    // if t0 > 0, va needs to change
                    // rhill 2011-06-03: we need to create a new vertex rather
                    // than modifying the existing one, since the existing
                    // one is likely shared with at least another edge
                    if (t0 > 0) {
                        edge.va = this.createVertex(ax + t0 * dx, ay + t0 * dy);
                    }

                    // if t1 < 1, vb needs to change
                    // rhill 2011-06-03: we need to create a new vertex rather
                    // than modifying the existing one, since the existing
                    // one is likely shared with at least another edge
                    if (t1 < 1) {
                        edge.vb = this.createVertex(ax + t1 * dx, ay + t1 * dy);
                    }

                    // va and/or vb were clipped, thus we will need to close
                    // cells which use this edge.
                    if (t0 > 0 || t1 < 1) {
                        this.cells[edge.lSite.voronoiId].closeMe = true;
                        this.cells[edge.rSite.voronoiId].closeMe = true;
                    }

                    return true;
                };

// Connect/cut edges at bounding box
                Voronoi.prototype.clipEdges = function (bbox) {
                    // connect all dangling edges to bounding box
                    // or get rid of them if it can't be done
                    var edges = this.edges,
                            iEdge = edges.length,
                            edge,
                            abs_fn = Math.abs;

                    // iterate backward so we can splice safely
                    while (iEdge--) {
                        edge = edges[iEdge];
                        // edge is removed if:
                        //   it is wholly outside the bounding box
                        //   it is looking more like a point than a line
                        if (!this.connectEdge(edge, bbox) ||
                                !this.clipEdge(edge, bbox) ||
                                (abs_fn(edge.va.x - edge.vb.x) < 1e-9 && abs_fn(edge.va.y - edge.vb.y) < 1e-9)) {
                            edge.va = edge.vb = null;
                            edges.splice(iEdge, 1);
                        }
                    }
                };

// Close the cells.
// The cells are bound by the supplied bounding box.
// Each cell refers to its associated site, and a list
// of halfedges ordered counterclockwise.
                Voronoi.prototype.closeCells = function (bbox) {
                    var xl = bbox.xl,
                            xr = bbox.xr,
                            yt = bbox.yt,
                            yb = bbox.yb,
                            cells = this.cells,
                            iCell = cells.length,
                            cell,
                            iLeft,
                            halfedges, nHalfedges,
                            edge,
                            va, vb, vz,
                            lastBorderSegment,
                            abs_fn = Math.abs;

                    while (iCell--) {
                        cell = cells[iCell];
                        // prune, order halfedges counterclockwise, then add missing ones
                        // required to close cells
                        if (!cell.prepareHalfedges()) {
                            continue;
                        }
                        if (!cell.closeMe) {
                            continue;
                        }
                        // find first 'unclosed' point.
                        // an 'unclosed' point will be the end point of a halfedge which
                        // does not match the start point of the following halfedge
                        halfedges = cell.halfedges;
                        nHalfedges = halfedges.length;
                        // special case: only one site, in which case, the viewport is the cell
                        // ...

                        // all other cases
                        iLeft = 0;
                        while (iLeft < nHalfedges) {
                            va = halfedges[iLeft].getEndpoint();
                            vz = halfedges[(iLeft + 1) % nHalfedges].getStartpoint();
                            // if end point is not equal to start point, we need to add the missing
                            // halfedge(s) up to vz
                            if (abs_fn(va.x - vz.x) >= 1e-9 || abs_fn(va.y - vz.y) >= 1e-9) {

                                // rhill 2013-12-02:
                                // "Holes" in the halfedges are not necessarily always adjacent.
                                // https://github.com/gorhill/Javascript-Voronoi/issues/16

                                // find entry point:
                                switch (true) {

                                    // walk downward along left side
                                    case this.equalWithEpsilon(va.x, xl) && this.lessThanWithEpsilon(va.y, yb):
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xl);
                                        vb = this.createVertex(xl, lastBorderSegment ? vz.y : yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk rightward along bottom side
                                    case this.equalWithEpsilon(va.y, yb) && this.lessThanWithEpsilon(va.x, xr):
                                        lastBorderSegment = this.equalWithEpsilon(vz.y, yb);
                                        vb = this.createVertex(lastBorderSegment ? vz.x : xr, yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk upward along right side
                                    case this.equalWithEpsilon(va.x, xr) && this.greaterThanWithEpsilon(va.y, yt):
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xr);
                                        vb = this.createVertex(xr, lastBorderSegment ? vz.y : yt);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk leftward along top side
                                    case this.equalWithEpsilon(va.y, yt) && this.greaterThanWithEpsilon(va.x, xl):
                                        lastBorderSegment = this.equalWithEpsilon(vz.y, yt);
                                        vb = this.createVertex(lastBorderSegment ? vz.x : xl, yt);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk downward along left side
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xl);
                                        vb = this.createVertex(xl, lastBorderSegment ? vz.y : yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk rightward along bottom side
                                        lastBorderSegment = this.equalWithEpsilon(vz.y, yb);
                                        vb = this.createVertex(lastBorderSegment ? vz.x : xr, yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk upward along right side
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xr);
                                        vb = this.createVertex(xr, lastBorderSegment ? vz.y : yt);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        // fall through

                                    default:
                                        throw "Voronoi.closeCells() > this makes no sense!";
                                }
                            }
                            iLeft++;
                        }
                        cell.closeMe = false;
                    }
                };

// ---------------------------------------------------------------------------
// Debugging helper
                /*
                 Voronoi.prototype.dumpBeachline = function(y) {
                 console.log('Voronoi.dumpBeachline(%f) > Beachsections, from left to right:', y);
                 if ( !this.beachline ) {
                 console.log('  None');
                 }
                 else {
                 var bs = this.beachline.getFirst(this.beachline.root);
                 while ( bs ) {
                 console.log('  site %d: xl: %f, xr: %f', bs.site.voronoiId, this.leftBreakPoint(bs, y), this.rightBreakPoint(bs, y));
                 bs = bs.rbNext;
                 }
                 }
                 };
                 */

// ---------------------------------------------------------------------------
// Helper: Quantize sites

// rhill 2013-10-12:
// This is to solve https://github.com/gorhill/Javascript-Voronoi/issues/15
// Since not all users will end up using the kind of coord values which would
// cause the issue to arise, I chose to let the user decide whether or not
// he should sanitize his coord values through this helper. This way, for
// those users who uses coord values which are known to be fine, no overhead is
// added.

                Voronoi.prototype.quantizeSites = function (sites) {
                    var ε = this.ε,
                            n = sites.length,
                            site;
                    while (n--) {
                        site = sites[n];
                        site.x = Math.floor(site.x / ε) * ε;
                        site.y = Math.floor(site.y / ε) * ε;
                    }
                };

// ---------------------------------------------------------------------------
// Helper: Recycle diagram: all vertex, edge and cell objects are
// "surrendered" to the Voronoi object for reuse.
// TODO: rhill-voronoi-core v2: more performance to be gained
// when I change the semantic of what is returned.

                Voronoi.prototype.recycle = function (diagram) {
                    if (diagram) {
                        if (diagram instanceof this.Diagram) {
                            this.toRecycle = diagram;
                        }
                        else {
                            throw 'Voronoi.recycleDiagram() > Need a Diagram object.';
                        }
                    }
                };

// ---------------------------------------------------------------------------
// Top-level Fortune loop

// rhill 2011-05-19:
//   Voronoi sites are kept client-side now, to allow
//   user to freely modify content. At compute time,
//   *references* to sites are copied locally.

                Voronoi.prototype.compute = function (sites, bbox) {
                    // to measure execution time
                    var startTime = new Date();

                    // init internal state
                    this.reset();

                    // any diagram data available for recycling?
                    // I do that here so that this is included in execution time
                    if (this.toRecycle) {
                        this.vertexJunkyard = this.vertexJunkyard.concat(this.toRecycle.vertices);
                        this.edgeJunkyard = this.edgeJunkyard.concat(this.toRecycle.edges);
                        this.cellJunkyard = this.cellJunkyard.concat(this.toRecycle.cells);
                        this.toRecycle = null;
                    }

                    // Initialize site event queue
                    var siteEvents = sites.slice(0);
                    siteEvents.sort(function (a, b) {
                        var r = b.y - a.y;
                        if (r) {
                            return r;
                        }
                        return b.x - a.x;
                    });

                    // process queue
                    var site = siteEvents.pop(),
                            siteid = 0,
                            xsitex, // to avoid duplicate sites
                            xsitey,
                            cells = this.cells,
                            circle;

                    // main loop
                    for (; ; ) {
                        // we need to figure whether we handle a site or circle event
                        // for this we find out if there is a site event and it is
                        // 'earlier' than the circle event
                        circle = this.firstCircleEvent;

                        // add beach section
                        if (site && (!circle || site.y < circle.y || (site.y === circle.y && site.x < circle.x))) {
                            // only if site is not a duplicate
                            if (site.x !== xsitex || site.y !== xsitey) {
                                // first create cell for new site
                                cells[siteid] = this.createCell(site);
                                site.voronoiId = siteid++;
                                // then create a beachsection for that site
                                this.addBeachsection(site);
                                // remember last site coords to detect duplicate
                                xsitey = site.y;
                                xsitex = site.x;
                            }
                            site = siteEvents.pop();
                        }

                        // remove beach section
                        else if (circle) {
                            this.removeBeachsection(circle.arc);
                        }

                        // all done, quit
                        else {
                            break;
                        }
                    }

                    // wrapping-up:
                    //   connect dangling edges to bounding box
                    //   cut edges as per bounding box
                    //   discard edges completely outside bounding box
                    //   discard edges which are point-like
                    this.clipEdges(bbox);

                    //   add missing edges in order to close opened cells
                    this.closeCells(bbox);

                    // to measure execution time
                    var stopTime = new Date();

                    // prepare return values
                    var diagram = new this.Diagram();
                    diagram.cells = this.cells;
                    diagram.edges = this.edges;
                    diagram.vertices = this.vertices;
                    diagram.execTime = stopTime.getTime() - startTime.getTime();

                    // clean up
                    this.reset();

                    return diagram;
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
                /*
                 * SECOND STEP: Tiding up of the graph.
                 *
                 * We use the method described by Gansner and North, based on Voronoi
                 * diagrams.
                 *
                 * Ref: doi:10.1007/3-540-37623-2_28
                 */

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
                    var inarray=[];
                dataVertices.forEach(function(node){
                        inarray.push(node.id);
                    });
                for (var i = 0; i < fv.length; ++i) {
                       inarray.forEach(
                            function(idnode){
                                if(idnode==fv[i].label)
                                {
                                     pData['vertices'].push({id: fv[i].label, x: fv[i].x, y: fv[i].y});
                            }
                        });   
                            
                }

                return pData;


            }),
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

                /*global Math */

// ---------------------------------------------------------------------------

                function Voronoi() {
                    this.vertices = null;
                    this.edges = null;
                    this.cells = null;
                    this.toRecycle = null;
                    this.beachsectionJunkyard = [];
                    this.circleEventJunkyard = [];
                    this.vertexJunkyard = [];
                    this.edgeJunkyard = [];
                    this.cellJunkyard = [];
                }

// ---------------------------------------------------------------------------

                Voronoi.prototype.reset = function () {
                    if (!this.beachline) {
                        this.beachline = new this.RBTree();
                    }
                    // Move leftover beachsections to the beachsection junkyard.
                    if (this.beachline.root) {
                        var beachsection = this.beachline.getFirst(this.beachline.root);
                        while (beachsection) {
                            this.beachsectionJunkyard.push(beachsection); // mark for reuse
                            beachsection = beachsection.rbNext;
                        }
                    }
                    this.beachline.root = null;
                    if (!this.circleEvents) {
                        this.circleEvents = new this.RBTree();
                    }
                    this.circleEvents.root = this.firstCircleEvent = null;
                    this.vertices = [];
                    this.edges = [];
                    this.cells = [];
                };

                Voronoi.prototype.sqrt = Math.sqrt;
                Voronoi.prototype.abs = Math.abs;
                Voronoi.prototype.ε = Voronoi.ε = 1e-9;
                Voronoi.prototype.invε = Voronoi.invε = 1.0 / Voronoi.ε;
                Voronoi.prototype.equalWithEpsilon = function (a, b) {
                    return this.abs(a - b) < 1e-9;
                };
                Voronoi.prototype.greaterThanWithEpsilon = function (a, b) {
                    return a - b > 1e-9;
                };
                Voronoi.prototype.greaterThanOrEqualWithEpsilon = function (a, b) {
                    return b - a < 1e-9;
                };
                Voronoi.prototype.lessThanWithEpsilon = function (a, b) {
                    return b - a > 1e-9;
                };
                Voronoi.prototype.lessThanOrEqualWithEpsilon = function (a, b) {
                    return a - b < 1e-9;
                };

// ---------------------------------------------------------------------------
// Red-Black tree code (based on C version of "rbtree" by Franck Bui-Huu
// https://github.com/fbuihuu/libtree/blob/master/rb.c

                Voronoi.prototype.RBTree = function () {
                    this.root = null;
                };

                Voronoi.prototype.RBTree.prototype.rbInsertSuccessor = function (node, successor) {
                    var parent;
                    if (node) {
                        // >>> rhill 2011-05-27: Performance: cache previous/next nodes
                        successor.rbPrevious = node;
                        successor.rbNext = node.rbNext;
                        if (node.rbNext) {
                            node.rbNext.rbPrevious = successor;
                        }
                        node.rbNext = successor;
                        // <<<
                        if (node.rbRight) {
                            // in-place expansion of node.rbRight.getFirst();
                            node = node.rbRight;
                            while (node.rbLeft) {
                                node = node.rbLeft;
                            }
                            node.rbLeft = successor;
                        }
                        else {
                            node.rbRight = successor;
                        }
                        parent = node;
                    }
                    // rhill 2011-06-07: if node is null, successor must be inserted
                    // to the left-most part of the tree
                    else if (this.root) {
                        node = this.getFirst(this.root);
                        // >>> Performance: cache previous/next nodes
                        successor.rbPrevious = null;
                        successor.rbNext = node;
                        node.rbPrevious = successor;
                        // <<<
                        node.rbLeft = successor;
                        parent = node;
                    }
                    else {
                        // >>> Performance: cache previous/next nodes
                        successor.rbPrevious = successor.rbNext = null;
                        // <<<
                        this.root = successor;
                        parent = null;
                    }
                    successor.rbLeft = successor.rbRight = null;
                    successor.rbParent = parent;
                    successor.rbRed = true;
                    // Fixup the modified tree by recoloring nodes and performing
                    // rotations (2 at most) hence the red-black tree properties are
                    // preserved.
                    var grandpa, uncle;
                    node = successor;
                    while (parent && parent.rbRed) {
                        grandpa = parent.rbParent;
                        if (parent === grandpa.rbLeft) {
                            uncle = grandpa.rbRight;
                            if (uncle && uncle.rbRed) {
                                parent.rbRed = uncle.rbRed = false;
                                grandpa.rbRed = true;
                                node = grandpa;
                            }
                            else {
                                if (node === parent.rbRight) {
                                    this.rbRotateLeft(parent);
                                    node = parent;
                                    parent = node.rbParent;
                                }
                                parent.rbRed = false;
                                grandpa.rbRed = true;
                                this.rbRotateRight(grandpa);
                            }
                        }
                        else {
                            uncle = grandpa.rbLeft;
                            if (uncle && uncle.rbRed) {
                                parent.rbRed = uncle.rbRed = false;
                                grandpa.rbRed = true;
                                node = grandpa;
                            }
                            else {
                                if (node === parent.rbLeft) {
                                    this.rbRotateRight(parent);
                                    node = parent;
                                    parent = node.rbParent;
                                }
                                parent.rbRed = false;
                                grandpa.rbRed = true;
                                this.rbRotateLeft(grandpa);
                            }
                        }
                        parent = node.rbParent;
                    }
                    this.root.rbRed = false;
                };

                Voronoi.prototype.RBTree.prototype.rbRemoveNode = function (node) {
                    // >>> rhill 2011-05-27: Performance: cache previous/next nodes
                    if (node.rbNext) {
                        node.rbNext.rbPrevious = node.rbPrevious;
                    }
                    if (node.rbPrevious) {
                        node.rbPrevious.rbNext = node.rbNext;
                    }
                    node.rbNext = node.rbPrevious = null;
                    // <<<
                    var parent = node.rbParent,
                            left = node.rbLeft,
                            right = node.rbRight,
                            next;
                    if (!left) {
                        next = right;
                    }
                    else if (!right) {
                        next = left;
                    }
                    else {
                        next = this.getFirst(right);
                    }
                    if (parent) {
                        if (parent.rbLeft === node) {
                            parent.rbLeft = next;
                        }
                        else {
                            parent.rbRight = next;
                        }
                    }
                    else {
                        this.root = next;
                    }
                    // enforce red-black rules
                    var isRed;
                    if (left && right) {
                        isRed = next.rbRed;
                        next.rbRed = node.rbRed;
                        next.rbLeft = left;
                        left.rbParent = next;
                        if (next !== right) {
                            parent = next.rbParent;
                            next.rbParent = node.rbParent;
                            node = next.rbRight;
                            parent.rbLeft = node;
                            next.rbRight = right;
                            right.rbParent = next;
                        }
                        else {
                            next.rbParent = parent;
                            parent = next;
                            node = next.rbRight;
                        }
                    }
                    else {
                        isRed = node.rbRed;
                        node = next;
                    }
                    // 'node' is now the sole successor's child and 'parent' its
                    // new parent (since the successor can have been moved)
                    if (node) {
                        node.rbParent = parent;
                    }
                    // the 'easy' cases
                    if (isRed) {
                        return;
                    }
                    if (node && node.rbRed) {
                        node.rbRed = false;
                        return;
                    }
                    // the other cases
                    var sibling;
                    do {
                        if (node === this.root) {
                            break;
                        }
                        if (node === parent.rbLeft) {
                            sibling = parent.rbRight;
                            if (sibling.rbRed) {
                                sibling.rbRed = false;
                                parent.rbRed = true;
                                this.rbRotateLeft(parent);
                                sibling = parent.rbRight;
                            }
                            if ((sibling.rbLeft && sibling.rbLeft.rbRed) || (sibling.rbRight && sibling.rbRight.rbRed)) {
                                if (!sibling.rbRight || !sibling.rbRight.rbRed) {
                                    sibling.rbLeft.rbRed = false;
                                    sibling.rbRed = true;
                                    this.rbRotateRight(sibling);
                                    sibling = parent.rbRight;
                                }
                                sibling.rbRed = parent.rbRed;
                                parent.rbRed = sibling.rbRight.rbRed = false;
                                this.rbRotateLeft(parent);
                                node = this.root;
                                break;
                            }
                        }
                        else {
                            sibling = parent.rbLeft;
                            if (sibling.rbRed) {
                                sibling.rbRed = false;
                                parent.rbRed = true;
                                this.rbRotateRight(parent);
                                sibling = parent.rbLeft;
                            }
                            if ((sibling.rbLeft && sibling.rbLeft.rbRed) || (sibling.rbRight && sibling.rbRight.rbRed)) {
                                if (!sibling.rbLeft || !sibling.rbLeft.rbRed) {
                                    sibling.rbRight.rbRed = false;
                                    sibling.rbRed = true;
                                    this.rbRotateLeft(sibling);
                                    sibling = parent.rbLeft;
                                }
                                sibling.rbRed = parent.rbRed;
                                parent.rbRed = sibling.rbLeft.rbRed = false;
                                this.rbRotateRight(parent);
                                node = this.root;
                                break;
                            }
                        }
                        sibling.rbRed = true;
                        node = parent;
                        parent = parent.rbParent;
                    } while (!node.rbRed);
                    if (node) {
                        node.rbRed = false;
                    }
                };

                Voronoi.prototype.RBTree.prototype.rbRotateLeft = function (node) {
                    var p = node,
                            q = node.rbRight, // can't be null
                            parent = p.rbParent;
                    if (parent) {
                        if (parent.rbLeft === p) {
                            parent.rbLeft = q;
                        }
                        else {
                            parent.rbRight = q;
                        }
                    }
                    else {
                        this.root = q;
                    }
                    q.rbParent = parent;
                    p.rbParent = q;
                    p.rbRight = q.rbLeft;
                    if (p.rbRight) {
                        p.rbRight.rbParent = p;
                    }
                    q.rbLeft = p;
                };

                Voronoi.prototype.RBTree.prototype.rbRotateRight = function (node) {
                    var p = node,
                            q = node.rbLeft, // can't be null
                            parent = p.rbParent;
                    if (parent) {
                        if (parent.rbLeft === p) {
                            parent.rbLeft = q;
                        }
                        else {
                            parent.rbRight = q;
                        }
                    }
                    else {
                        this.root = q;
                    }
                    q.rbParent = parent;
                    p.rbParent = q;
                    p.rbLeft = q.rbRight;
                    if (p.rbLeft) {
                        p.rbLeft.rbParent = p;
                    }
                    q.rbRight = p;
                };

                Voronoi.prototype.RBTree.prototype.getFirst = function (node) {
                    while (node.rbLeft) {
                        node = node.rbLeft;
                    }
                    return node;
                };

                Voronoi.prototype.RBTree.prototype.getLast = function (node) {
                    while (node.rbRight) {
                        node = node.rbRight;
                    }
                    return node;
                };

// ---------------------------------------------------------------------------
// Diagram methods

                Voronoi.prototype.Diagram = function (site) {
                    this.site = site;
                };

// ---------------------------------------------------------------------------
// Cell methods

                Voronoi.prototype.Cell = function (site) {
                    this.site = site;
                    this.halfedges = [];
                    this.closeMe = false;
                };

                Voronoi.prototype.Cell.prototype.init = function (site) {
                    this.site = site;
                    this.halfedges = [];
                    this.closeMe = false;
                    return this;
                };

                Voronoi.prototype.createCell = function (site) {
                    var cell = this.cellJunkyard.pop();
                    if (cell) {
                        return cell.init(site);
                    }
                    return new this.Cell(site);
                };

                Voronoi.prototype.Cell.prototype.prepareHalfedges = function () {
                    var halfedges = this.halfedges,
                            iHalfedge = halfedges.length,
                            edge;
                    // get rid of unused halfedges
                    // rhill 2011-05-27: Keep it simple, no point here in trying
                    // to be fancy: dangling edges are a typically a minority.
                    while (iHalfedge--) {
                        edge = halfedges[iHalfedge].edge;
                        if (!edge.vb || !edge.va) {
                            halfedges.splice(iHalfedge, 1);
                        }
                    }

                    // rhill 2011-05-26: I tried to use a binary search at insertion
                    // time to keep the array sorted on-the-fly (in Cell.addHalfedge()).
                    // There was no real benefits in doing so, performance on
                    // Firefox 3.6 was improved marginally, while performance on
                    // Opera 11 was penalized marginally.
                    halfedges.sort(function (a, b) {
                        return b.angle - a.angle;
                    });
                    return halfedges.length;
                };

// Return a list of the neighbor Ids
                Voronoi.prototype.Cell.prototype.getNeighborIds = function () {
                    var neighbors = [],
                            iHalfedge = this.halfedges.length,
                            edge;
                    while (iHalfedge--) {
                        edge = this.halfedges[iHalfedge].edge;
                        if (edge.lSite !== null && edge.lSite.voronoiId != this.site.voronoiId) {
                            neighbors.push(edge.lSite.voronoiId);
                        }
                        else if (edge.rSite !== null && edge.rSite.voronoiId != this.site.voronoiId) {
                            neighbors.push(edge.rSite.voronoiId);
                        }
                    }
                    return neighbors;
                };

// Compute bounding box
//
                Voronoi.prototype.Cell.prototype.getBbox = function () {
                    var halfedges = this.halfedges,
                            iHalfedge = halfedges.length,
                            xmin = Infinity,
                            ymin = Infinity,
                            xmax = -Infinity,
                            ymax = -Infinity,
                            v, vx, vy;
                    while (iHalfedge--) {
                        v = halfedges[iHalfedge].getStartpoint();
                        vx = v.x;
                        vy = v.y;
                        if (vx < xmin) {
                            xmin = vx;
                        }
                        if (vy < ymin) {
                            ymin = vy;
                        }
                        if (vx > xmax) {
                            xmax = vx;
                        }
                        if (vy > ymax) {
                            ymax = vy;
                        }
                        // we dont need to take into account end point,
                        // since each end point matches a start point
                    }
                    return {
                        x: xmin,
                        y: ymin,
                        width: xmax - xmin,
                        height: ymax - ymin
                    };
                };

// Return whether a point is inside, on, or outside the cell:
//   -1: point is outside the perimeter of the cell
//    0: point is on the perimeter of the cell
//    1: point is inside the perimeter of the cell
//
                Voronoi.prototype.Cell.prototype.pointIntersection = function (x, y) {
                    // Check if point in polygon. Since all polygons of a Voronoi
                    // diagram are convex, then:
                    // http://paulbourke.net/geometry/polygonmesh/
                    // Solution 3 (2D):
                    //   "If the polygon is convex then one can consider the polygon
                    //   "as a 'path' from the first vertex. A point is on the interior
                    //   "of this polygons if it is always on the same side of all the
                    //   "line segments making up the path. ...
                    //   "(y - y0) (x1 - x0) - (x - x0) (y1 - y0)
                    //   "if it is less than 0 then P is to the right of the line segment,
                    //   "if greater than 0 it is to the left, if equal to 0 then it lies
                    //   "on the line segment"
                    var halfedges = this.halfedges,
                            iHalfedge = halfedges.length,
                            halfedge,
                            p0, p1, r;
                    while (iHalfedge--) {
                        halfedge = halfedges[iHalfedge];
                        p0 = halfedge.getStartpoint();
                        p1 = halfedge.getEndpoint();
                        r = (y - p0.y) * (p1.x - p0.x) - (x - p0.x) * (p1.y - p0.y);
                        if (!r) {
                            return 0;
                        }
                        if (r > 0) {
                            return -1;
                        }
                    }
                    return 1;
                };

// ---------------------------------------------------------------------------
// Edge methods
//

                Voronoi.prototype.Vertex = function (x, y) {
                    this.x = x;
                    this.y = y;
                };

                Voronoi.prototype.Edge = function (lSite, rSite) {
                    this.lSite = lSite;
                    this.rSite = rSite;
                    this.va = this.vb = null;
                };

                Voronoi.prototype.Halfedge = function (edge, lSite, rSite) {
                    this.site = lSite;
                    this.edge = edge;
                    // 'angle' is a value to be used for properly sorting the
                    // halfsegments counterclockwise. By convention, we will
                    // use the angle of the line defined by the 'site to the left'
                    // to the 'site to the right'.
                    // However, border edges have no 'site to the right': thus we
                    // use the angle of line perpendicular to the halfsegment (the
                    // edge should have both end points defined in such case.)
                    if (rSite) {
                        this.angle = Math.atan2(rSite.y - lSite.y, rSite.x - lSite.x);
                    }
                    else {
                        var va = edge.va,
                                vb = edge.vb;
                        // rhill 2011-05-31: used to call getStartpoint()/getEndpoint(),
                        // but for performance purpose, these are expanded in place here.
                        this.angle = edge.lSite === lSite ?
                                Math.atan2(vb.x - va.x, va.y - vb.y) :
                                Math.atan2(va.x - vb.x, vb.y - va.y);
                    }
                };

                Voronoi.prototype.createHalfedge = function (edge, lSite, rSite) {
                    return new this.Halfedge(edge, lSite, rSite);
                };

                Voronoi.prototype.Halfedge.prototype.getStartpoint = function () {
                    return this.edge.lSite === this.site ? this.edge.va : this.edge.vb;
                };

                Voronoi.prototype.Halfedge.prototype.getEndpoint = function () {
                    return this.edge.lSite === this.site ? this.edge.vb : this.edge.va;
                };



// this create and add a vertex to the internal collection

                Voronoi.prototype.createVertex = function (x, y) {
                    var v = this.vertexJunkyard.pop();
                    if (!v) {
                        v = new this.Vertex(x, y);
                    }
                    else {
                        v.x = x;
                        v.y = y;
                    }
                    this.vertices.push(v);
                    return v;
                };

// this create and add an edge to internal collection, and also create
// two halfedges which are added to each site's counterclockwise array
// of halfedges.

                Voronoi.prototype.createEdge = function (lSite, rSite, va, vb) {
                    var edge = this.edgeJunkyard.pop();
                    if (!edge) {
                        edge = new this.Edge(lSite, rSite);
                    }
                    else {
                        edge.lSite = lSite;
                        edge.rSite = rSite;
                        edge.va = edge.vb = null;
                    }

                    this.edges.push(edge);
                    if (va) {
                        this.setEdgeStartpoint(edge, lSite, rSite, va);
                    }
                    if (vb) {
                        this.setEdgeEndpoint(edge, lSite, rSite, vb);
                    }
                    this.cells[lSite.voronoiId].halfedges.push(this.createHalfedge(edge, lSite, rSite));
                    this.cells[rSite.voronoiId].halfedges.push(this.createHalfedge(edge, rSite, lSite));
                    return edge;
                };

                Voronoi.prototype.createBorderEdge = function (lSite, va, vb) {
                    var edge = this.edgeJunkyard.pop();
                    if (!edge) {
                        edge = new this.Edge(lSite, null);
                    }
                    else {
                        edge.lSite = lSite;
                        edge.rSite = null;
                    }
                    edge.va = va;
                    edge.vb = vb;
                    this.edges.push(edge);
                    return edge;
                };

                Voronoi.prototype.setEdgeStartpoint = function (edge, lSite, rSite, vertex) {
                    if (!edge.va && !edge.vb) {
                        edge.va = vertex;
                        edge.lSite = lSite;
                        edge.rSite = rSite;
                    }
                    else if (edge.lSite === rSite) {
                        edge.vb = vertex;
                    }
                    else {
                        edge.va = vertex;
                    }
                };

                Voronoi.prototype.setEdgeEndpoint = function (edge, lSite, rSite, vertex) {
                    this.setEdgeStartpoint(edge, rSite, lSite, vertex);
                };

// ---------------------------------------------------------------------------
// Beachline methods

// rhill 2011-06-07: For some reasons, performance suffers significantly
// when instanciating a literal object instead of an empty ctor
                Voronoi.prototype.Beachsection = function () {
                };

// rhill 2011-06-02: A lot of Beachsection instanciations
// occur during the computation of the Voronoi diagram,
// somewhere between the number of sites and twice the
// number of sites, while the number of Beachsections on the
// beachline at any given time is comparatively low. For this
// reason, we reuse already created Beachsections, in order
// to avoid new memory allocation. This resulted in a measurable
// performance gain.

                Voronoi.prototype.createBeachsection = function (site) {
                    var beachsection = this.beachsectionJunkyard.pop();
                    if (!beachsection) {
                        beachsection = new this.Beachsection();
                    }
                    beachsection.site = site;
                    return beachsection;
                };

// calculate the left break point of a particular beach section,
// given a particular sweep line
                Voronoi.prototype.leftBreakPoint = function (arc, directrix) {
                    // http://en.wikipedia.org/wiki/Parabola
                    // http://en.wikipedia.org/wiki/Quadratic_equation
                    // h1 = x1,
                    // k1 = (y1+directrix)/2,
                    // h2 = x2,
                    // k2 = (y2+directrix)/2,
                    // p1 = k1-directrix,
                    // a1 = 1/(4*p1),
                    // b1 = -h1/(2*p1),
                    // c1 = h1*h1/(4*p1)+k1,
                    // p2 = k2-directrix,
                    // a2 = 1/(4*p2),
                    // b2 = -h2/(2*p2),
                    // c2 = h2*h2/(4*p2)+k2,
                    // x = (-(b2-b1) + Math.sqrt((b2-b1)*(b2-b1) - 4*(a2-a1)*(c2-c1))) / (2*(a2-a1))
                    // When x1 become the x-origin:
                    // h1 = 0,
                    // k1 = (y1+directrix)/2,
                    // h2 = x2-x1,
                    // k2 = (y2+directrix)/2,
                    // p1 = k1-directrix,
                    // a1 = 1/(4*p1),
                    // b1 = 0,
                    // c1 = k1,
                    // p2 = k2-directrix,
                    // a2 = 1/(4*p2),
                    // b2 = -h2/(2*p2),
                    // c2 = h2*h2/(4*p2)+k2,
                    // x = (-b2 + Math.sqrt(b2*b2 - 4*(a2-a1)*(c2-k1))) / (2*(a2-a1)) + x1

                    // change code below at your own risk: care has been taken to
                    // reduce errors due to computers' finite arithmetic precision.
                    // Maybe can still be improved, will see if any more of this
                    // kind of errors pop up again.
                    var site = arc.site,
                            rfocx = site.x,
                            rfocy = site.y,
                            pby2 = rfocy - directrix;
                    // parabola in degenerate case where focus is on directrix
                    if (!pby2) {
                        return rfocx;
                    }
                    var lArc = arc.rbPrevious;
                    if (!lArc) {
                        return -Infinity;
                    }
                    site = lArc.site;
                    var lfocx = site.x,
                            lfocy = site.y,
                            plby2 = lfocy - directrix;
                    // parabola in degenerate case where focus is on directrix
                    if (!plby2) {
                        return lfocx;
                    }
                    var hl = lfocx - rfocx,
                            aby2 = 1 / pby2 - 1 / plby2,
                            b = hl / plby2;
                    if (aby2) {
                        return (-b + this.sqrt(b * b - 2 * aby2 * (hl * hl / (-2 * plby2) - lfocy + plby2 / 2 + rfocy - pby2 / 2))) / aby2 + rfocx;
                    }
                    // both parabolas have same distance to directrix, thus break point is midway
                    return (rfocx + lfocx) / 2;
                };

// calculate the right break point of a particular beach section,
// given a particular directrix
                Voronoi.prototype.rightBreakPoint = function (arc, directrix) {
                    var rArc = arc.rbNext;
                    if (rArc) {
                        return this.leftBreakPoint(rArc, directrix);
                    }
                    var site = arc.site;
                    return site.y === directrix ? site.x : Infinity;
                };

                Voronoi.prototype.detachBeachsection = function (beachsection) {
                    this.detachCircleEvent(beachsection); // detach potentially attached circle event
                    this.beachline.rbRemoveNode(beachsection); // remove from RB-tree
                    this.beachsectionJunkyard.push(beachsection); // mark for reuse
                };

                Voronoi.prototype.removeBeachsection = function (beachsection) {
                    var circle = beachsection.circleEvent,
                            x = circle.x,
                            y = circle.ycenter,
                            vertex = this.createVertex(x, y),
                            previous = beachsection.rbPrevious,
                            next = beachsection.rbNext,
                            disappearingTransitions = [beachsection],
                            abs_fn = Math.abs;

                    // remove collapsed beachsection from beachline
                    this.detachBeachsection(beachsection);

                    // there could be more than one empty arc at the deletion point, this
                    // happens when more than two edges are linked by the same vertex,
                    // so we will collect all those edges by looking up both sides of
                    // the deletion point.
                    // by the way, there is *always* a predecessor/successor to any collapsed
                    // beach section, it's just impossible to have a collapsing first/last
                    // beach sections on the beachline, since they obviously are unconstrained
                    // on their left/right side.

                    // look left
                    var lArc = previous;
                    while (lArc.circleEvent && abs_fn(x - lArc.circleEvent.x) < 1e-9 && abs_fn(y - lArc.circleEvent.ycenter) < 1e-9) {
                        previous = lArc.rbPrevious;
                        disappearingTransitions.unshift(lArc);
                        this.detachBeachsection(lArc); // mark for reuse
                        lArc = previous;
                    }
                    // even though it is not disappearing, I will also add the beach section
                    // immediately to the left of the left-most collapsed beach section, for
                    // convenience, since we need to refer to it later as this beach section
                    // is the 'left' site of an edge for which a start point is set.
                    disappearingTransitions.unshift(lArc);
                    this.detachCircleEvent(lArc);

                    // look right
                    var rArc = next;
                    while (rArc.circleEvent && abs_fn(x - rArc.circleEvent.x) < 1e-9 && abs_fn(y - rArc.circleEvent.ycenter) < 1e-9) {
                        next = rArc.rbNext;
                        disappearingTransitions.push(rArc);
                        this.detachBeachsection(rArc); // mark for reuse
                        rArc = next;
                    }
                    // we also have to add the beach section immediately to the right of the
                    // right-most collapsed beach section, since there is also a disappearing
                    // transition representing an edge's start point on its left.
                    disappearingTransitions.push(rArc);
                    this.detachCircleEvent(rArc);

                    // walk through all the disappearing transitions between beach sections and
                    // set the start point of their (implied) edge.
                    var nArcs = disappearingTransitions.length,
                            iArc;
                    for (iArc = 1; iArc < nArcs; iArc++) {
                        rArc = disappearingTransitions[iArc];
                        lArc = disappearingTransitions[iArc - 1];
                        this.setEdgeStartpoint(rArc.edge, lArc.site, rArc.site, vertex);
                    }

                    // create a new edge as we have now a new transition between
                    // two beach sections which were previously not adjacent.
                    // since this edge appears as a new vertex is defined, the vertex
                    // actually define an end point of the edge (relative to the site
                    // on the left)
                    lArc = disappearingTransitions[0];
                    rArc = disappearingTransitions[nArcs - 1];
                    rArc.edge = this.createEdge(lArc.site, rArc.site, undefined, vertex);

                    // create circle events if any for beach sections left in the beachline
                    // adjacent to collapsed sections
                    this.attachCircleEvent(lArc);
                    this.attachCircleEvent(rArc);
                };

                Voronoi.prototype.addBeachsection = function (site) {
                    var x = site.x,
                            directrix = site.y;

                    // find the left and right beach sections which will surround the newly
                    // created beach section.
                    // rhill 2011-06-01: This loop is one of the most often executed,
                    // hence we expand in-place the comparison-against-epsilon calls.
                    var lArc, rArc,
                            dxl, dxr,
                            node = this.beachline.root;

                    while (node) {
                        dxl = this.leftBreakPoint(node, directrix) - x;
                        // x lessThanWithEpsilon xl => falls somewhere before the left edge of the beachsection
                        if (dxl > 1e-9) {
                            // this case should never happen
                            // if (!node.rbLeft) {
                            //    rArc = node.rbLeft;
                            //    break;
                            //    }
                            node = node.rbLeft;
                        }
                        else {
                            dxr = x - this.rightBreakPoint(node, directrix);
                            // x greaterThanWithEpsilon xr => falls somewhere after the right edge of the beachsection
                            if (dxr > 1e-9) {
                                if (!node.rbRight) {
                                    lArc = node;
                                    break;
                                }
                                node = node.rbRight;
                            }
                            else {
                                // x equalWithEpsilon xl => falls exactly on the left edge of the beachsection
                                if (dxl > -1e-9) {
                                    lArc = node.rbPrevious;
                                    rArc = node;
                                }
                                // x equalWithEpsilon xr => falls exactly on the right edge of the beachsection
                                else if (dxr > -1e-9) {
                                    lArc = node;
                                    rArc = node.rbNext;
                                }
                                // falls exactly somewhere in the middle of the beachsection
                                else {
                                    lArc = rArc = node;
                                }
                                break;
                            }
                        }
                    }
                    // at this point, keep in mind that lArc and/or rArc could be
                    // undefined or null.

                    // create a new beach section object for the site and add it to RB-tree
                    var newArc = this.createBeachsection(site);
                    this.beachline.rbInsertSuccessor(lArc, newArc);

                    // cases:
                    //

                    // [null,null]
                    // least likely case: new beach section is the first beach section on the
                    // beachline.
                    // This case means:
                    //   no new transition appears
                    //   no collapsing beach section
                    //   new beachsection become root of the RB-tree
                    if (!lArc && !rArc) {
                        return;
                    }

                    // [lArc,rArc] where lArc == rArc
                    // most likely case: new beach section split an existing beach
                    // section.
                    // This case means:
                    //   one new transition appears
                    //   the left and right beach section might be collapsing as a result
                    //   two new nodes added to the RB-tree
                    if (lArc === rArc) {
                        // invalidate circle event of split beach section
                        this.detachCircleEvent(lArc);

                        // split the beach section into two separate beach sections
                        rArc = this.createBeachsection(lArc.site);
                        this.beachline.rbInsertSuccessor(newArc, rArc);

                        // since we have a new transition between two beach sections,
                        // a new edge is born
                        newArc.edge = rArc.edge = this.createEdge(lArc.site, newArc.site);

                        // check whether the left and right beach sections are collapsing
                        // and if so create circle events, to be notified when the point of
                        // collapse is reached.
                        this.attachCircleEvent(lArc);
                        this.attachCircleEvent(rArc);
                        return;
                    }

                    // [lArc,null]
                    // even less likely case: new beach section is the *last* beach section
                    // on the beachline -- this can happen *only* if *all* the previous beach
                    // sections currently on the beachline share the same y value as
                    // the new beach section.
                    // This case means:
                    //   one new transition appears
                    //   no collapsing beach section as a result
                    //   new beach section become right-most node of the RB-tree
                    if (lArc && !rArc) {
                        newArc.edge = this.createEdge(lArc.site, newArc.site);
                        return;
                    }

                    // [null,rArc]
                    // impossible case: because sites are strictly processed from top to bottom,
                    // and left to right, which guarantees that there will always be a beach section
                    // on the left -- except of course when there are no beach section at all on
                    // the beach line, which case was handled above.
                    // rhill 2011-06-02: No point testing in non-debug version
                    //if (!lArc && rArc) {
                    //    throw "Voronoi.addBeachsection(): What is this I don't even";
                    //    }

                    // [lArc,rArc] where lArc != rArc
                    // somewhat less likely case: new beach section falls *exactly* in between two
                    // existing beach sections
                    // This case means:
                    //   one transition disappears
                    //   two new transitions appear
                    //   the left and right beach section might be collapsing as a result
                    //   only one new node added to the RB-tree
                    if (lArc !== rArc) {
                        // invalidate circle events of left and right sites
                        this.detachCircleEvent(lArc);
                        this.detachCircleEvent(rArc);

                        // an existing transition disappears, meaning a vertex is defined at
                        // the disappearance point.
                        // since the disappearance is caused by the new beachsection, the
                        // vertex is at the center of the circumscribed circle of the left,
                        // new and right beachsections.
                        // http://mathforum.org/library/drmath/view/55002.html
                        // Except that I bring the origin at A to simplify
                        // calculation
                        var lSite = lArc.site,
                                ax = lSite.x,
                                ay = lSite.y,
                                bx = site.x - ax,
                                by = site.y - ay,
                                rSite = rArc.site,
                                cx = rSite.x - ax,
                                cy = rSite.y - ay,
                                d = 2 * (bx * cy - by * cx),
                                hb = bx * bx + by * by,
                                hc = cx * cx + cy * cy,
                                vertex = this.createVertex((cy * hb - by * hc) / d + ax, (bx * hc - cx * hb) / d + ay);

                        // one transition disappear
                        this.setEdgeStartpoint(rArc.edge, lSite, rSite, vertex);

                        // two new transitions appear at the new vertex location
                        newArc.edge = this.createEdge(lSite, site, undefined, vertex);
                        rArc.edge = this.createEdge(site, rSite, undefined, vertex);

                        // check whether the left and right beach sections are collapsing
                        // and if so create circle events, to handle the point of collapse.
                        this.attachCircleEvent(lArc);
                        this.attachCircleEvent(rArc);
                        return;
                    }
                };

// ---------------------------------------------------------------------------
// Circle event methods

// rhill 2011-06-07: For some reasons, performance suffers significantly
// when instanciating a literal object instead of an empty ctor
                Voronoi.prototype.CircleEvent = function () {
                    // rhill 2013-10-12: it helps to state exactly what we are at ctor time.
                    this.arc = null;
                    this.rbLeft = null;
                    this.rbNext = null;
                    this.rbParent = null;
                    this.rbPrevious = null;
                    this.rbRed = false;
                    this.rbRight = null;
                    this.site = null;
                    this.x = this.y = this.ycenter = 0;
                };

                Voronoi.prototype.attachCircleEvent = function (arc) {
                    var lArc = arc.rbPrevious,
                            rArc = arc.rbNext;
                    if (!lArc || !rArc) {
                        return;
                    } // does that ever happen?
                    var lSite = lArc.site,
                            cSite = arc.site,
                            rSite = rArc.site;

                    // If site of left beachsection is same as site of
                    // right beachsection, there can't be convergence
                    if (lSite === rSite) {
                        return;
                    }

                    // Find the circumscribed circle for the three sites associated
                    // with the beachsection triplet.
                    // rhill 2011-05-26: It is more efficient to calculate in-place
                    // rather than getting the resulting circumscribed circle from an
                    // object returned by calling Voronoi.circumcircle()
                    // http://mathforum.org/library/drmath/view/55002.html
                    // Except that I bring the origin at cSite to simplify calculations.
                    // The bottom-most part of the circumcircle is our Fortune 'circle
                    // event', and its center is a vertex potentially part of the final
                    // Voronoi diagram.
                    var bx = cSite.x,
                            by = cSite.y,
                            ax = lSite.x - bx,
                            ay = lSite.y - by,
                            cx = rSite.x - bx,
                            cy = rSite.y - by;

                    // If points l->c->r are clockwise, then center beach section does not
                    // collapse, hence it can't end up as a vertex (we reuse 'd' here, which
                    // sign is reverse of the orientation, hence we reverse the test.
                    // http://en.wikipedia.org/wiki/Curve_orientation#Orientation_of_a_simple_polygon
                    // rhill 2011-05-21: Nasty finite precision error which caused circumcircle() to
                    // return infinites: 1e-12 seems to fix the problem.
                    var d = 2 * (ax * cy - ay * cx);
                    if (d >= -2e-12) {
                        return;
                    }

                    var ha = ax * ax + ay * ay,
                            hc = cx * cx + cy * cy,
                            x = (cy * ha - ay * hc) / d,
                            y = (ax * hc - cx * ha) / d,
                            ycenter = y + by;

                    // Important: ybottom should always be under or at sweep, so no need
                    // to waste CPU cycles by checking

                    // recycle circle event object if possible
                    var circleEvent = this.circleEventJunkyard.pop();
                    if (!circleEvent) {
                        circleEvent = new this.CircleEvent();
                    }
                    circleEvent.arc = arc;
                    circleEvent.site = cSite;
                    circleEvent.x = x + bx;
                    circleEvent.y = ycenter + this.sqrt(x * x + y * y); // y bottom
                    circleEvent.ycenter = ycenter;
                    arc.circleEvent = circleEvent;

                    // find insertion point in RB-tree: circle events are ordered from
                    // smallest to largest
                    var predecessor = null,
                            node = this.circleEvents.root;
                    while (node) {
                        if (circleEvent.y < node.y || (circleEvent.y === node.y && circleEvent.x <= node.x)) {
                            if (node.rbLeft) {
                                node = node.rbLeft;
                            }
                            else {
                                predecessor = node.rbPrevious;
                                break;
                            }
                        }
                        else {
                            if (node.rbRight) {
                                node = node.rbRight;
                            }
                            else {
                                predecessor = node;
                                break;
                            }
                        }
                    }
                    this.circleEvents.rbInsertSuccessor(predecessor, circleEvent);
                    if (!predecessor) {
                        this.firstCircleEvent = circleEvent;
                    }
                };

                Voronoi.prototype.detachCircleEvent = function (arc) {
                    var circleEvent = arc.circleEvent;
                    if (circleEvent) {
                        if (!circleEvent.rbPrevious) {
                            this.firstCircleEvent = circleEvent.rbNext;
                        }
                        this.circleEvents.rbRemoveNode(circleEvent); // remove from RB-tree
                        this.circleEventJunkyard.push(circleEvent);
                        arc.circleEvent = null;
                    }
                };

// ---------------------------------------------------------------------------
// Diagram completion methods

// connect dangling edges (not if a cursory test tells us
// it is not going to be visible.
// return value:
//   false: the dangling endpoint couldn't be connected
//   true: the dangling endpoint could be connected
                Voronoi.prototype.connectEdge = function (edge, bbox) {
                    // skip if end point already connected
                    var vb = edge.vb;
                    if (!!vb) {
                        return true;
                    }

                    // make local copy for performance purpose
                    var va = edge.va,
                            xl = bbox.xl,
                            xr = bbox.xr,
                            yt = bbox.yt,
                            yb = bbox.yb,
                            lSite = edge.lSite,
                            rSite = edge.rSite,
                            lx = lSite.x,
                            ly = lSite.y,
                            rx = rSite.x,
                            ry = rSite.y,
                            fx = (lx + rx) / 2,
                            fy = (ly + ry) / 2,
                            fm, fb;

                    // if we reach here, this means cells which use this edge will need
                    // to be closed, whether because the edge was removed, or because it
                    // was connected to the bounding box.
                    this.cells[lSite.voronoiId].closeMe = true;
                    this.cells[rSite.voronoiId].closeMe = true;

                    // get the line equation of the bisector if line is not vertical
                    if (ry !== ly) {
                        fm = (lx - rx) / (ry - ly);
                        fb = fy - fm * fx;
                    }

                    // remember, direction of line (relative to left site):
                    // upward: left.x < right.x
                    // downward: left.x > right.x
                    // horizontal: left.x == right.x
                    // upward: left.x < right.x
                    // rightward: left.y < right.y
                    // leftward: left.y > right.y
                    // vertical: left.y == right.y

                    // depending on the direction, find the best side of the
                    // bounding box to use to determine a reasonable start point

                    // rhill 2013-12-02:
                    // While at it, since we have the values which define the line,
                    // clip the end of va if it is outside the bbox.
                    // https://github.com/gorhill/Javascript-Voronoi/issues/15
                    // TODO: Do all the clipping here rather than rely on Liang-Barsky
                    // which does not do well sometimes due to loss of arithmetic
                    // precision. The code here doesn't degrade if one of the vertex is
                    // at a huge distance.

                    // special case: vertical line
                    if (fm === undefined) {
                        // doesn't intersect with viewport
                        if (fx < xl || fx >= xr) {
                            return false;
                        }
                        // downward
                        if (lx > rx) {
                            if (!va || va.y < yt) {
                                va = this.createVertex(fx, yt);
                            }
                            else if (va.y >= yb) {
                                return false;
                            }
                            vb = this.createVertex(fx, yb);
                        }
                        // upward
                        else {
                            if (!va || va.y > yb) {
                                va = this.createVertex(fx, yb);
                            }
                            else if (va.y < yt) {
                                return false;
                            }
                            vb = this.createVertex(fx, yt);
                        }
                    }
                    // closer to vertical than horizontal, connect start point to the
                    // top or bottom side of the bounding box
                    else if (fm < -1 || fm > 1) {
                        // downward
                        if (lx > rx) {
                            if (!va || va.y < yt) {
                                va = this.createVertex((yt - fb) / fm, yt);
                            }
                            else if (va.y >= yb) {
                                return false;
                            }
                            vb = this.createVertex((yb - fb) / fm, yb);
                        }
                        // upward
                        else {
                            if (!va || va.y > yb) {
                                va = this.createVertex((yb - fb) / fm, yb);
                            }
                            else if (va.y < yt) {
                                return false;
                            }
                            vb = this.createVertex((yt - fb) / fm, yt);
                        }
                    }
                    // closer to horizontal than vertical, connect start point to the
                    // left or right side of the bounding box
                    else {
                        // rightward
                        if (ly < ry) {
                            if (!va || va.x < xl) {
                                va = this.createVertex(xl, fm * xl + fb);
                            }
                            else if (va.x >= xr) {
                                return false;
                            }
                            vb = this.createVertex(xr, fm * xr + fb);
                        }
                        // leftward
                        else {
                            if (!va || va.x > xr) {
                                va = this.createVertex(xr, fm * xr + fb);
                            }
                            else if (va.x < xl) {
                                return false;
                            }
                            vb = this.createVertex(xl, fm * xl + fb);
                        }
                    }
                    edge.va = va;
                    edge.vb = vb;

                    return true;
                };

// line-clipping code taken from:
//   Liang-Barsky function by Daniel White
//   http://www.skytopia.com/project/articles/compsci/clipping.html
// Thanks!
// A bit modified to minimize code paths
                Voronoi.prototype.clipEdge = function (edge, bbox) {
                    var ax = edge.va.x,
                            ay = edge.va.y,
                            bx = edge.vb.x,
                            by = edge.vb.y,
                            t0 = 0,
                            t1 = 1,
                            dx = bx - ax,
                            dy = by - ay;
                    // left
                    var q = ax - bbox.xl;
                    if (dx === 0 && q < 0) {
                        return false;
                    }
                    var r = -q / dx;
                    if (dx < 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }
                    else if (dx > 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    // right
                    q = bbox.xr - ax;
                    if (dx === 0 && q < 0) {
                        return false;
                    }
                    r = q / dx;
                    if (dx < 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    else if (dx > 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }
                    // top
                    q = ay - bbox.yt;
                    if (dy === 0 && q < 0) {
                        return false;
                    }
                    r = -q / dy;
                    if (dy < 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }
                    else if (dy > 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    // bottom        
                    q = bbox.yb - ay;
                    if (dy === 0 && q < 0) {
                        return false;
                    }
                    r = q / dy;
                    if (dy < 0) {
                        if (r > t1) {
                            return false;
                        }
                        if (r > t0) {
                            t0 = r;
                        }
                    }
                    else if (dy > 0) {
                        if (r < t0) {
                            return false;
                        }
                        if (r < t1) {
                            t1 = r;
                        }
                    }

                    // if we reach this point, Voronoi edge is within bbox

                    // if t0 > 0, va needs to change
                    // rhill 2011-06-03: we need to create a new vertex rather
                    // than modifying the existing one, since the existing
                    // one is likely shared with at least another edge
                    if (t0 > 0) {
                        edge.va = this.createVertex(ax + t0 * dx, ay + t0 * dy);
                    }

                    // if t1 < 1, vb needs to change
                    // rhill 2011-06-03: we need to create a new vertex rather
                    // than modifying the existing one, since the existing
                    // one is likely shared with at least another edge
                    if (t1 < 1) {
                        edge.vb = this.createVertex(ax + t1 * dx, ay + t1 * dy);
                    }

                    // va and/or vb were clipped, thus we will need to close
                    // cells which use this edge.
                    if (t0 > 0 || t1 < 1) {
                        this.cells[edge.lSite.voronoiId].closeMe = true;
                        this.cells[edge.rSite.voronoiId].closeMe = true;
                    }

                    return true;
                };

// Connect/cut edges at bounding box
                Voronoi.prototype.clipEdges = function (bbox) {
                    // connect all dangling edges to bounding box
                    // or get rid of them if it can't be done
                    var edges = this.edges,
                            iEdge = edges.length,
                            edge,
                            abs_fn = Math.abs;

                    // iterate backward so we can splice safely
                    while (iEdge--) {
                        edge = edges[iEdge];
                        // edge is removed if:
                        //   it is wholly outside the bounding box
                        //   it is looking more like a point than a line
                        if (!this.connectEdge(edge, bbox) ||
                                !this.clipEdge(edge, bbox) ||
                                (abs_fn(edge.va.x - edge.vb.x) < 1e-9 && abs_fn(edge.va.y - edge.vb.y) < 1e-9)) {
                            edge.va = edge.vb = null;
                            edges.splice(iEdge, 1);
                        }
                    }
                };

// Close the cells.
// The cells are bound by the supplied bounding box.
// Each cell refers to its associated site, and a list
// of halfedges ordered counterclockwise.
                Voronoi.prototype.closeCells = function (bbox) {
                    var xl = bbox.xl,
                            xr = bbox.xr,
                            yt = bbox.yt,
                            yb = bbox.yb,
                            cells = this.cells,
                            iCell = cells.length,
                            cell,
                            iLeft,
                            halfedges, nHalfedges,
                            edge,
                            va, vb, vz,
                            lastBorderSegment,
                            abs_fn = Math.abs;

                    while (iCell--) {
                        cell = cells[iCell];
                        // prune, order halfedges counterclockwise, then add missing ones
                        // required to close cells
                        if (!cell.prepareHalfedges()) {
                            continue;
                        }
                        if (!cell.closeMe) {
                            continue;
                        }
                        // find first 'unclosed' point.
                        // an 'unclosed' point will be the end point of a halfedge which
                        // does not match the start point of the following halfedge
                        halfedges = cell.halfedges;
                        nHalfedges = halfedges.length;
                        // special case: only one site, in which case, the viewport is the cell
                        // ...

                        // all other cases
                        iLeft = 0;
                        while (iLeft < nHalfedges) {
                            va = halfedges[iLeft].getEndpoint();
                            vz = halfedges[(iLeft + 1) % nHalfedges].getStartpoint();
                            // if end point is not equal to start point, we need to add the missing
                            // halfedge(s) up to vz
                            if (abs_fn(va.x - vz.x) >= 1e-9 || abs_fn(va.y - vz.y) >= 1e-9) {

                                // rhill 2013-12-02:
                                // "Holes" in the halfedges are not necessarily always adjacent.
                                // https://github.com/gorhill/Javascript-Voronoi/issues/16

                                // find entry point:
                                switch (true) {

                                    // walk downward along left side
                                    case this.equalWithEpsilon(va.x, xl) && this.lessThanWithEpsilon(va.y, yb):
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xl);
                                        vb = this.createVertex(xl, lastBorderSegment ? vz.y : yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk rightward along bottom side
                                    case this.equalWithEpsilon(va.y, yb) && this.lessThanWithEpsilon(va.x, xr):
                                        lastBorderSegment = this.equalWithEpsilon(vz.y, yb);
                                        vb = this.createVertex(lastBorderSegment ? vz.x : xr, yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk upward along right side
                                    case this.equalWithEpsilon(va.x, xr) && this.greaterThanWithEpsilon(va.y, yt):
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xr);
                                        vb = this.createVertex(xr, lastBorderSegment ? vz.y : yt);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk leftward along top side
                                    case this.equalWithEpsilon(va.y, yt) && this.greaterThanWithEpsilon(va.x, xl):
                                        lastBorderSegment = this.equalWithEpsilon(vz.y, yt);
                                        vb = this.createVertex(lastBorderSegment ? vz.x : xl, yt);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk downward along left side
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xl);
                                        vb = this.createVertex(xl, lastBorderSegment ? vz.y : yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk rightward along bottom side
                                        lastBorderSegment = this.equalWithEpsilon(vz.y, yb);
                                        vb = this.createVertex(lastBorderSegment ? vz.x : xr, yb);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        va = vb;
                                        // fall through

                                        // walk upward along right side
                                        lastBorderSegment = this.equalWithEpsilon(vz.x, xr);
                                        vb = this.createVertex(xr, lastBorderSegment ? vz.y : yt);
                                        edge = this.createBorderEdge(cell.site, va, vb);
                                        iLeft++;
                                        halfedges.splice(iLeft, 0, this.createHalfedge(edge, cell.site, null));
                                        nHalfedges++;
                                        if (lastBorderSegment) {
                                            break;
                                        }
                                        // fall through

                                    default:
                                        throw "Voronoi.closeCells() > this makes no sense!";
                                }
                            }
                            iLeft++;
                        }
                        cell.closeMe = false;
                    }
                };

// ---------------------------------------------------------------------------
// Debugging helper
                /*
                 Voronoi.prototype.dumpBeachline = function(y) {
                 console.log('Voronoi.dumpBeachline(%f) > Beachsections, from left to right:', y);
                 if ( !this.beachline ) {
                 console.log('  None');
                 }
                 else {
                 var bs = this.beachline.getFirst(this.beachline.root);
                 while ( bs ) {
                 console.log('  site %d: xl: %f, xr: %f', bs.site.voronoiId, this.leftBreakPoint(bs, y), this.rightBreakPoint(bs, y));
                 bs = bs.rbNext;
                 }
                 }
                 };
                 */

// ---------------------------------------------------------------------------
// Helper: Quantize sites

// rhill 2013-10-12:
// This is to solve https://github.com/gorhill/Javascript-Voronoi/issues/15
// Since not all users will end up using the kind of coord values which would
// cause the issue to arise, I chose to let the user decide whether or not
// he should sanitize his coord values through this helper. This way, for
// those users who uses coord values which are known to be fine, no overhead is
// added.

                Voronoi.prototype.quantizeSites = function (sites) {
                    var ε = this.ε,
                            n = sites.length,
                            site;
                    while (n--) {
                        site = sites[n];
                        site.x = Math.floor(site.x / ε) * ε;
                        site.y = Math.floor(site.y / ε) * ε;
                    }
                };

// ---------------------------------------------------------------------------
// Helper: Recycle diagram: all vertex, edge and cell objects are
// "surrendered" to the Voronoi object for reuse.
// TODO: rhill-voronoi-core v2: more performance to be gained
// when I change the semantic of what is returned.

                Voronoi.prototype.recycle = function (diagram) {
                    if (diagram) {
                        if (diagram instanceof this.Diagram) {
                            this.toRecycle = diagram;
                        }
                        else {
                            throw 'Voronoi.recycleDiagram() > Need a Diagram object.';
                        }
                    }
                };

// ---------------------------------------------------------------------------
// Top-level Fortune loop

// rhill 2011-05-19:
//   Voronoi sites are kept client-side now, to allow
//   user to freely modify content. At compute time,
//   *references* to sites are copied locally.

                Voronoi.prototype.compute = function (sites, bbox) {
                    // to measure execution time
                    var startTime = new Date();

                    // init internal state
                    this.reset();

                    // any diagram data available for recycling?
                    // I do that here so that this is included in execution time
                    if (this.toRecycle) {
                        this.vertexJunkyard = this.vertexJunkyard.concat(this.toRecycle.vertices);
                        this.edgeJunkyard = this.edgeJunkyard.concat(this.toRecycle.edges);
                        this.cellJunkyard = this.cellJunkyard.concat(this.toRecycle.cells);
                        this.toRecycle = null;
                    }

                    // Initialize site event queue
                    var siteEvents = sites.slice(0);
                    siteEvents.sort(function (a, b) {
                        var r = b.y - a.y;
                        if (r) {
                            return r;
                        }
                        return b.x - a.x;
                    });

                    // process queue
                    var site = siteEvents.pop(),
                            siteid = 0,
                            xsitex, // to avoid duplicate sites
                            xsitey,
                            cells = this.cells,
                            circle;

                    // main loop
                    for (; ; ) {
                        // we need to figure whether we handle a site or circle event
                        // for this we find out if there is a site event and it is
                        // 'earlier' than the circle event
                        circle = this.firstCircleEvent;

                        // add beach section
                        if (site && (!circle || site.y < circle.y || (site.y === circle.y && site.x < circle.x))) {
                            // only if site is not a duplicate
                            if (site.x !== xsitex || site.y !== xsitey) {
                                // first create cell for new site
                                cells[siteid] = this.createCell(site);
                                site.voronoiId = siteid++;
                                // then create a beachsection for that site
                                this.addBeachsection(site);
                                // remember last site coords to detect duplicate
                                xsitey = site.y;
                                xsitex = site.x;
                            }
                            site = siteEvents.pop();
                        }

                        // remove beach section
                        else if (circle) {
                            this.removeBeachsection(circle.arc);
                        }

                        // all done, quit
                        else {
                            break;
                        }
                    }

                    // wrapping-up:
                    //   connect dangling edges to bounding box
                    //   cut edges as per bounding box
                    //   discard edges completely outside bounding box
                    //   discard edges which are point-like
                    this.clipEdges(bbox);

                    //   add missing edges in order to close opened cells
                    this.closeCells(bbox);

                    // to measure execution time
                    var stopTime = new Date();

                    // prepare return values
                    var diagram = new this.Diagram();
                    diagram.cells = this.cells;
                    diagram.edges = this.edges;
                    diagram.vertices = this.vertices;
                    diagram.execTime = stopTime.getTime() - startTime.getTime();

                    // clean up
                    this.reset();

                    return diagram;
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
              
              
                /*
                 * SECOND STEP: Tiding up of the graph.
                 *
                 * We use the method described by Gansner and North, based on Voronoi
                 * diagrams.
                 *
                 * Ref: doi:10.1007/3-540-37623-2_28
                 */

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
                var inarray=[];
                dataVertices.forEach(function(node){
                        inarray.push(node.id);
                    });
                for (var i = 0; i < fv.length; ++i) {
                       inarray.forEach(
                            function(idnode){
                                if(idnode==fv[i].label)
                                {
                                     pData['vertices'].push({id: fv[i].label, x: fv[i].x, y: fv[i].y});
                            }
                        });   
                            
                }
        return pData;
          })
        ]).then(function (thens) {
            var pData = thens[0];
            var pData2 = thens[1];
            var pData3 = thens[2];
            var pData4 = thens[3];
          
         
            
            // First we retrieve the important data
            var expandIteration = pData['expIt'];
            var dataVertices = pData['vertices'].concat(pData2['vertices']).concat(pData3['vertices']).concat(pData4['vertices']);
 
           var vertices = [];
            for (var i = 0; i < dataVertices.length; ++i) {
                var dv = dataVertices[i];
           vertices[dv.id] = {x: dv.x, y: dv.y};
            }
            /*
             * FINALLY:
             *
             * We position the nodes based on the calculation
             */
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
            t1.stop();
            next();
        });
        return this;
    };




    SpreadLayout.prototype.stop = function () {
    };

    $$('layout', 'spread', SpreadLayout);
})(cytoscape);
