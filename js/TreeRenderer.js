(function(){

Utils.namespace('VYRE.ForeFront');

VYRE.ForeFront.Node = function(id, name, nodeObject, parent ) {
	
	this.id = id;
	this.name = name;
	this.data = nodeObject;
	this.isSelected = false;
	this.isLoaded = false;
	this.isChildrenLoaded = false;
	
	this.hierarchy = {
		children: [],
		parent: parent || null
	};
		
}

VYRE.ForeFront.Node.prototype = {
		
	// returns parent node
	parent: function() {
		return this.hierarchy.parent;
	},
	
	isRoot: function() {
		return (this.id == "root");
	},
	
	isLeaf: function() {
		return this.children().length == 0;
	},
	
	setChildren: function(children) {
		this.hierarchy.children = children || [];		
	},
	
	// returns children nodes
	children: function() {
		return this.hierarchy.children;
	},
	
	setSelected: function() {
		
		var selectParent = function(node) {
			
			if (node instanceof VYRE.ForeFront.Node && !node.isRoot() ) {
				if (!node.isSelected) {
					node.isSelected = true;
					selectParent( node.parent() );
				}
			}
			
		}
		
		selectParent(this);
		
	},
	
	addChild: function(node) {
		if ( !Utils.inArray( node, this.children() ) ) {
			this.hierarchy.children.push(node);
		}
	},
	
	removeChild: function(node) {
		
		var children = this.children();
						
		if ( Utils.inArray( node, children ) ) {
			var index = children.indexOf(node);
			this.hierarchy.children.splice(index,1);
		}
				
	},
	
	appendParent: function(parent) {
		var path = "";
		
		if (parent instanceof VYRE.ForeFront.Node && !parent.isRoot() ) {
			path = "/" + parent.name + path ;
							
			path = this.appendParent( parent.parent() ) + path;
		}
		
		return path;
	},
	
	getParentPath: function() {
		return this.appendParent( this.parent() ) || "root";
	},
		
	getPath: function(parent) {
		
		return this.appendParent(this);
	},
	
	hasSelectedChildren: function() {
		if ( this.hierarchy.children.length > 0) {
			for (var i =0; i < this.hierarchy.children.length; i++) {
				var child = this.hierarchy.children[i];
								
				if (child.isSelected) {
					return true;
				}
				
			}
		}
		return false;
	},
	
	hasAllSelectedChildren: function() {
		if ( this.hierarchy.children.length > 0) {
			for (var i =0; i < this.hierarchy.children.length; i++) {
				var child = this.hierarchy.children[i];
				if (!child.isSelected) {
					return false;
				}
				
			}
		} else {
			return false;
		}
		return true;	
	}
			
}

		
VYRE.ForeFront.NodeCollection = VYRE.ForeFront.EventTarget.extend({
		
		initialize : function(data){
			this._super();
			
			this.nodeMap = {};
			this.nodePathMap = {};
			this.nodeParentPathMap = {};
			this.idPointer = 0;
			
			this.index(data);
			
		},
		
		// return node object of path
		getNode: function(reference) {
			return (typeof reference == "number") ?  this.nodeMap[reference] : false;
		},
		
		getRootNode: function() {
			return this.root;
		},
				
		getSelectedNodes: function() {
			
			var nodeList = [];
			
			Utils.objectIterator(this.nodeMap, function(key, node) {
				if (node.isSelected) {
					nodeList.push( node );
				}
			})
			
			return nodeList;
		},
		
		_addNode: function(parent, data) {
			// data for node
			
			
			var id = (parent == "root") ? "root" : this.idPointer++;
			var name = data.name;

			var node = new VYRE.ForeFront.Node(id, name, data, parent );
			
			if (parent instanceof VYRE.ForeFront.Node) {
				parent.addChild(node);
			}
						
			if (data.selected) {
				node.setSelected();
				delete data.selected;
			}
			
			this.nodeMap[id] = node;
			
			var path = node.getPath();
			var parentPath = node.getParentPath();
			
			if (typeof this.nodeParentPathMap[parentPath] == "undefined") {
				this.nodeParentPathMap[parentPath] = [];
			}
			
			if (typeof(data.children) != "undefined") {
				Utils.forEach(data.children, this._addNode.bind(this, node) );
			}

			this.nodeParentPathMap[parentPath].push(node);
			this.nodePathMap[path] = node;
						
			return node;
		},
		
		addNode: function(parent, data) {
			
			if (parent instanceof VYRE.ForeFront.Node) {
				var node = this._addNode(parent, data );
				this.fire("addNode", node );
			}
			
			
		},
		
		removeNode: function(ref) {
			var node = false;
			
			if (ref instanceof VYRE.ForeFront.Node) {
				node = ref;
			} else {
				node = this.getNode(ref);
			}
			
			var removeChild = function(node) {
				var children = node.children();
				
				Utils.forEach(children, removeChild.bind(this) );
				
				if (node instanceof VYRE.ForeFront.Node && !node.isRoot() ) {
				
					delete this.nodePathMap[ node.getPath() ];
					delete this.nodeParentPathMap[ node.getParentPath() ];
					delete this.nodeMap[node.id];
										
					node.parent().removeChild(node);
					
					delete node;
					
				}
				
			}
			
			if (!node) {
				return false;
			} else {
					this.fire("removeNode", node);
					removeChild.bind(this, node)();
			}
						
		},

		index: function(data) {
			
			this.root = this._addNode("root", {} );

			Utils.forEach(data, this._addNode.bind(this, this.root) );
									
			this.fire("reindex", this.nodeParentPathMap);
		}
		
	});
		

VYRE.ForeFront.TreeComponent = Class.extend({
	
	initialize: function(settings) {
		
		this.nodeCollection = settings.collection;
		this.nodeRenderer = settings.nodeRenderer;
		this.container = $(settings.target);

		this.changeHandler = settings.changeHandler || function() {};
		
		this.renderRoot();
		this.bindEvents();
	},
	
	renderRoot: function() {
		
		var root = this.nodeCollection.getRootNode().children();
				
		var html = this.childNodeMarkup(root, "tree");
								
		this.container.html(html);
		
	},
	
	bindEvents: function() {
		
		this.nodeCollection.on("reindex", this.renderRoot.bind(this) );
		this.nodeCollection.on("addNode", this.afterAddNode.bind(this) );
		this.nodeCollection.on("removeNode", this.afterRemoveNode.bind(this) );
		
		this.container.delegate("span", "click", this.openNode.bind(this) );
		
		this.container.delegate("label", "click", this.internalHandler.bind(this, "click") );
		this.container.delegate("input:checkbox", "click", this.internalHandler.bind(this, "click") );

	},
		
	internalHandler: function(type, e) {
				
		var li = jQuery(e.target || e.srcElement).closest("li");
		var id = li.attr("class").match("node_([\\d]+)")[1];
		var node = this.nodeCollection.getNode( Number(id) );
						
		if ( node.isSelected ) {
			this.unselectNode(node);
		} else {
			this.selectNode(node);
		}
		
		this.changeHandler();
						
		e.stopPropagation();
		
	},
	
	selectNode: function(node) {
		
		/** node is clicked on
		* Scenerio 1 : node has a mix of selected nodes
		* - select all children
		*
		* Scenerio 2: select all parents til the root
		* - select parent til root
		**/

		var selectNodes = "";
		var self = this;
		
		var selectChildren = function(nodeChild) {
			
			if ( (nodeChild instanceof VYRE.ForeFront.Node) && !nodeChild.isSelected && !node.isRoot()) {
				
				nodeChild.isSelected = true;
				selectNodes += self.selectSelector(nodeChild);
												
				for (var i =0; i < nodeChild.children().length; i++) {
					var child = nodeChild.children()[i];
					selectChildren(child);
				}
			
			}
			
			return false;
		}
				
		var selectParent = function(node) {
			
			if ( (node instanceof VYRE.ForeFront.Node) && !node.isSelected && !node.isRoot() ) {
				node.isSelected = true;
				selectNodes += self.selectSelector(node);
				selectParent( node.parent() );
			}
			
		}
		
		//selectChildren(node);
		selectParent( node );
								
		$(selectNodes).prop("checked", true);
		
				
	},
	
	unselectNode: function(node) {
		
		/** node is clicked on
		* Scenerio 1 : node has selected children
		* - uncheck all children
		* 
		* Scenerio 2 : node has all selected nodes
		* - if all node children are selected
		* - unselect all children
		*
		**/
		
		var unselectNodes = "";
		var self = this;
		
		// scenerio 1
		var unselectParent = function(node) {
						
			if ( (node instanceof VYRE.ForeFront.Node) && node.isSelected && !node.hasSelectedChildren() && !node.isRoot() ) {
				node.isSelected = false;
				unselectNodes +=  self.selectSelector(node);
				unselectParent( node.parent() );
			}
			
			return false;
		}
				
		// scenerio 3
		var unselectChildren = function(node) {
			
			var children = node.children();
			for (var i =0; i < children.length; i++) {
				var child = children[i];
				
				if (child.isSelected) {
					
					child.isSelected = false;
					unselectNodes +=  self.selectSelector(child);
			
					unselectChildren(child);
				}
								
			}
			
			return false;
			
		}
		unselectChildren(node);	
		unselectParent( node )
				
		$(unselectNodes).prop("checked", false);
		
	},
	
	selectSelector: function(node) {
		if (node.isLoaded) {
			return "input.checkbox_{id}, ".supplant({id:node.id});
		}
		return "";
	},
	
	afterAddNode: function(node) {
		var parent = node.parent();
				
		if (parent.isChildrenLoaded) {
			this.renderNode( node.parent() )
		}
		
		this.changeHandler();
	},
	
	afterRemoveNode: function(node) {
		
		this.unselectNode(node);
		var li = $(".node_"+node.id);
		li.remove();
			
		this.changeHandler();
	},	
	
	openNode: function(e) {
		var li = jQuery(e.target || e.srcElement).closest("li");
		
		if (!li.hasClass("loaded")) {
			var id = li.attr("class").match("node_([\\d]+)")[1];
			
			var node = this.nodeCollection.getNode( Number(id) );
			this.renderNode(node);
		}
		
		this.toggleLi(li);
		
		
	},
	
	renderNode: function(node) {

		var children = node.children();
		var li = $("li.node_"+node.id);
					
		var html = "";
		html += this.childNodeMarkup(children);
		
		node.isChildrenLoaded = true;
		
		li.addClass("loaded").find("ul").remove();
		li.append(html);
	},
	
	toggleLi: function(li) {
		if (li.hasClass("closed")) {
			li.removeClass("closed").addClass("open");
		} else {
			li.removeClass("open").addClass("closed");
		}
	},
	
	childNodeMarkup: function(children, extraClass) {
		extraClass = extraClass || "";
		var html = "<ul class=\"{ec}\">".supplant({ec: extraClass });

		for (var i=0; i < children.length; i++ ) {
			var node = children[i];
			node.isLoaded = true;
			html += new this.nodeRenderer(node).markup();
		}
		
		html += "</ul>";
		
		return html;
	}
	
	
		
});




VYRE.ForeFront.NodeRenderer = Class.extend({
	
	initialize: function(node) {
		this.node = node;
	},
	
	getClassNames: function() {
		var n = this.node;
		
		var classes = "checkbox node_"+n.id+ " ";
				
		if ( !n.isLeaf() ) {			
			classes += "closed ";
		} 
		
		return classes;
	},
	
	markup: function() {
		
		var n = this.node;
		
		var backingObject = jQuery.extend({}, n.data, {
			classes: this.getClassNames(),
			checked: (n.isSelected ? "checked" : ""),
			nodeId: n.id
		})
						
		return "<li class=\"{classes}\"><span></span><input type=\"checkbox\" {checked} class=\"checkbox_{nodeId}\"/><label>{prettyName}</label></li>".supplant(backingObject);
	}
	
})


})();









