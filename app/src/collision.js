// Agonia Engine - Native Collision System
// Extracted from SuperDuperMovement.js (MIT, Korolev). Built-in engine module.

var Direction = { UP: 8, LEFT: 4, DOWN: 2, RIGHT: 6 };
var DOM_PARSER = typeof DOMParser !== "undefined" ? new DOMParser() : null;
var PRESETS = [];
var PLAY_TEST = { COLLISION_MESH_CACHING: false };

  function CollisionMesh() {
    throw new Error( 'This is a static class' );
  }
  ( function() {

    CollisionMesh.WALK = 0;
    CollisionMesh.BOAT = 1;
    CollisionMesh.SHIP = 2;
    CollisionMesh.AIRSHIP = 3;

    CollisionMesh.meshInMemory = { mapId: null, mesh: [] };

    CollisionMesh.getMesh = function( mapId, type ) {
      type = type || CollisionMesh.WALK;

      if ( CollisionMesh.meshInMemory.mapId === mapId ) {
        return CollisionMesh.meshInMemory.mesh[type];
      }

      var cacheName = 'cache_mesh%1'.format( mapId.padZero( 3 ) );
      // Agonia: never load the stale storage cache — stamp colliders must
      // rebuild the mesh fresh each map entry (in-memory cache still applies).
      if ( false && ( PLAY_TEST.COLLISION_MESH_CACHING && $gameTemp.isPlaytest() ) && StorageManager.exists( cacheName ) ) {
        CollisionMesh.meshInMemory.mapId = mapId;
        CollisionMesh.meshInMemory.mesh = JsonEx.parse( StorageManager.load( cacheName ) );
      } else {
        var gameMap;
        if ( $gameMap.mapId() === mapId ) {
          gameMap = $gameMap;
        } else {
          gameMap = new Game_Map();
          gameMap.setup( mapId );
        }

        CollisionMesh.meshInMemory.mapId = mapId;
        CollisionMesh.meshInMemory.mesh[CollisionMesh.WALK] = CollisionMesh.makeCollisionMesh( gameMap, gameMap.isPassable );
        if ( !gameMap.boat().isTransparent() ) {
          CollisionMesh.meshInMemory.mesh[CollisionMesh.BOAT] = CollisionMesh.makeCollisionMesh( gameMap, gameMap.isBoatPassable );
        }
        if ( !gameMap.ship().isTransparent() ) {
          CollisionMesh.meshInMemory.mesh[CollisionMesh.SHIP] = CollisionMesh.makeCollisionMesh( gameMap, gameMap.isShipPassable );
        }
        if ( !gameMap.airship().isTransparent() ) {
          CollisionMesh.meshInMemory.mesh[CollisionMesh.AIRSHIP] = CollisionMesh.makeCollisionMesh( gameMap );
        }
        StorageManager.save( cacheName, JSON.prune( CollisionMesh.meshInMemory.mesh ) );
      }

      return CollisionMesh.meshInMemory.mesh[type];
    };

    CollisionMesh.addTileDCollisionObject = function( x, y, object, scale, tileWidth, tileHeight, colliders ) {
      x += object.x / tileWidth;
      y += object.y / tileHeight;
      if ( object.polygon ) {
        var polygon = [];
        for ( var ii = 0; ii < object.polygon.length; ii++ ) {
          polygon[ii] = [
            x + ( object.polygon[ii].x / tileWidth ),
            y + ( object.polygon[ii].y / tileHeight )
          ];
        }
        colliders.push( Collider.createPolygon( polygon ) );
      } else if ( object.polyline ) {
        var polylines;
        if ( object.polyline.length == 2 ) {
          polylines = Collider.createPolygon( [
            [x + ( object.polyline[0].x / tileWidth ), y + ( object.polyline[0].y / tileWidth )],
            [x + ( object.polyline[1].x / tileHeight ), y + ( object.polyline[1].y / tileHeight )]
          ] );
        } else {
          polylines = Collider.createList();
          for ( var ii = 0; ii < ( object.polyline.length - 1 ); ii++ ) {
            Collider.addToList( polylines, Collider.createPolygon( [
              [x + ( object.polyline[ii].x / tileWidth ), y + ( object.polyline[ii].y / tileWidth )],
              [x + ( object.polyline[ii + 1].x / tileHeight ), y + ( object.polyline[ii + 1].y / tileHeight )]
            ] ) );
          }
        }
        colliders.push( polylines );
      } else if ( object.ellipse ) {
        if ( object.width == object.height ) {
          var rad = ( object.width / tileWidth ) / 2;
          colliders.push( Collider.createCircle( x + rad, y + rad, rad ) );
        } else {
          var rx = ( object.width / tileWidth ) / 2;
          var ry = ( object.height / tileHeight ) / 2;
          var points = ( object.properties && object.properties.points ) ? object.properties.points : 8;
          colliders.push( Collider.createRegularPolygon( x + rx, y + ry, rx, ry, points ) );
        }
      } else {
        var w = object.width / tileWidth;
        var h = object.height / tileHeight;
        colliders.push( Collider.createRect( x, y, w, h ) );
      }
    };

    CollisionMesh.makeCollisionMesh = function( gameMap, passFunc ) {
      var collisionGrid = [];
      if ( !passFunc ) {
        passFunc = function( x, y, d ) { return true; };
      }
      for ( var xx = 0; xx < gameMap.width(); xx++ ) {
        collisionGrid[xx] = [];
        for ( var yy = 0; yy < gameMap.height(); yy++ ) {
          collisionGrid[xx][yy] = 0;
          if ( !passFunc.call( gameMap, xx, yy, Direction.UP ) ) {
            collisionGrid[xx][yy] |= ( 0x1 << 0 );
          }
          if ( !passFunc.call( gameMap, xx, yy, Direction.LEFT ) ) {
            collisionGrid[xx][yy] |= ( 0x1 << 1 );
          }
          if ( !passFunc.call( gameMap, xx, yy, Direction.DOWN ) ) {
            collisionGrid[xx][yy] |= ( 0x1 << 2 );
          }
          if ( !passFunc.call( gameMap, xx, yy, Direction.RIGHT ) ) {
            collisionGrid[xx][yy] |= ( 0x1 << 3 );
          }
        }
      }

      var colliders = [];
      var d = 2;

      if ( !gameMap.isLoopHorizontal() ) {
        var q = gameMap.isLoopVertical() ? 0 : d;
        colliders.push( Collider.createPolygon(
          [ [ 0, 0 ], [ 0, gameMap.height() ], [ -d, gameMap.height() + q ] , [ -d, -q ]  ]
        ) );
        colliders.push( Collider.createPolygon(
          [ [ gameMap.width(), gameMap.height() ], [ gameMap.width(), 0 ], [ gameMap.width() + d, -q ], [ gameMap.width() + d, gameMap.height() + q ] ]
        ) );
      }
      if ( !gameMap.isLoopVertical() ) {
        var q = gameMap.isLoopHorizontal() ? 0 : d;
        colliders.push( Collider.createPolygon(
          [ [ gameMap.width(), 0 ], [ 0, 0 ], [ -q, -d ], [ gameMap.width() + q, -d ] ]
        ) );
        colliders.push( Collider.createPolygon(
          [ [ 0, gameMap.height() ], [ gameMap.width(), gameMap.height() ], [ gameMap.width() + q, gameMap.height() + d ], [ -q, gameMap.height() + d ] ]
        ) );
      }

      for ( var yy = 0; yy < gameMap.height(); yy++ ) {
        var top = gameMap.roundY( yy - 1 );
        var bottom = gameMap.roundY( yy + 1 );
        for ( var xx = 0; xx < gameMap.width(); xx++ ) {
          if ( collisionGrid[xx][yy] !== 0xf ) {
            continue;
          }

          var left = gameMap.roundX( xx - 1 );
          var right = gameMap.roundX( xx + 1 );

          var open = 0;
          if ( left < 0 || collisionGrid[left][yy] == 0 ) {
            open++;
          }
          if ( top < 0 || collisionGrid[xx][top] == 0 ) {
            open++;
          }
          if ( right >= gameMap.width() || collisionGrid[right][yy] == 0 ) {
            open++;
          }
          if ( bottom >= gameMap.height() || collisionGrid[xx][bottom] == 0 ) {
            open++;
          }

          if ( open === 4 ) {
            collisionGrid[xx][yy] = 0;
            colliders.push( Collider.createPolygon( [
              [ xx, yy ],
              [ xx + 1, yy ],
              [ xx + 1, yy + 1 ],
              [ xx, yy + 1 ],
            ] ) );
          }
        }
      }

      var horizontalLine = null;
      var hColliders = [];
      for ( var yy = 0; yy < gameMap.height(); yy++ ) {
        for ( var xx = 0; xx < gameMap.width(); xx++ ) {
          var y2 = gameMap.roundY( yy - 1 );
          if ( ( collisionGrid[xx][yy] & ( 0x1 << 0 ) || ( y2 >= 0 && collisionGrid[xx][y2] & ( 0x1 << 2 ) ) ) ) {
            if ( !horizontalLine ) {
              horizontalLine = [[xx, yy]];
            }
            horizontalLine[1] = [xx + 1, yy];
          } else if ( !!horizontalLine ) {
            hColliders.push( Collider.createPolygon( horizontalLine ) );
            horizontalLine = null;
          }
        }
        if ( !!horizontalLine ) {
          hColliders.push( Collider.createPolygon( horizontalLine ) );
          horizontalLine = null;
        }
      }

      var verticalLine = null;
      var vColliders = [];
      for ( var xx = 0; xx < gameMap.width(); xx++ ) {
        for ( var yy = 0; yy < gameMap.height(); yy++ ) {
          var x2 = gameMap.roundX( xx - 1 );
          if ( ( collisionGrid[xx][yy] & ( 0x1 << 1 ) || ( x2 >= 0 && collisionGrid[x2][yy] & ( 0x1 << 3 ) ) ) ) {
            if ( !verticalLine ) {
              verticalLine = [[xx, yy]];
            }
            verticalLine[1] = [xx, yy + 1];
          } else if ( !!verticalLine ) {
            vColliders.push( Collider.createPolygon( verticalLine ) );
            verticalLine = null;
          }
        }
        if ( !!verticalLine ) {
          vColliders.push( Collider.createPolygon( verticalLine ) );
          verticalLine = null;
        }
      }

      if ( gameMap.tiledData ) {
        var tileWidth = gameMap.tileWidth();
        var tileHeight = gameMap.tileHeight();
        var scale = ( gameMap.isHalfTile && gameMap.isHalfTile() ) ? 2 : 1;
        var tilesetColliders = [];

        var tilesets = gameMap.tiledData.tilesets;
        for ( var ii = 0; ii < tilesets.length; ii++ ) {
          tilesetColliders[ii] = {};

          var tiles = tilesets[ii].tiles;
          for ( var key in tiles ) {
            if ( tiles[key].objectgroup ) {
              tilesetColliders[ii][key] = tiles[key].objectgroup.objects;
            }
          }
        }

        for ( var ii = 0; ii < gameMap.tiledData.layers.length; ii++ ) {
          var layer = gameMap.tiledData.layers[ii];
          for ( var yy = 0; yy < layer.height; yy++ ) {
            var row = yy * layer.width;
            for ( var xx = 0; xx < layer.width; xx++ ) {
              var tileId = layer.data[row + xx];
              if ( tileId === 0 ) {
                continue;
              }
              tileId++;

              var tilesetId = -1;
              var firstId = 0;
              for ( var jj = 0; jj < gameMap.tiledData.tilesets.length; jj++ ) {
                firstId = gameMap.tiledData.tilesets[jj].firstgid;
                var lastId = firstId + gameMap.tiledData.tilesets[jj].tilecount;
                if ( tileId >= firstId && tileId <= lastId ) {
                  tilesetId = jj;
                  break;
                }
              }
              if ( tilesetId < 0 ) {
                continue;
              }

              var tileSet = tilesetColliders[tilesetId];
              var objectGroup = tileSet['' + ( tileId - firstId - 1 )];
              if ( objectGroup ) {
                for ( var jj = 0; jj < objectGroup.length; jj++ ) {
                  var object = objectGroup[jj];
                  var x = xx * scale;
                  var y = yy * scale;
                  CollisionMesh.addTileDCollisionObject( x, y, object, scale, tileWidth, tileHeight, colliders );
                }
              }
            }
          }
        }

        for ( var ii = 0; ii < gameMap.tiledData.layers.length; ii++ ) {
          var layer = gameMap.tiledData.layers[ii];
          if ( layer.type == "objectgroup" && layer.properties && layer.properties.collision == "mesh" ) {
            for ( var jj = 0; jj < layer.objects.length; jj++ ) {
              CollisionMesh.addTileDCollisionObject( 0, 0, layer.objects[jj], scale, tileWidth, tileHeight, colliders );
            }
          }
        }
      }

      // === Agonia Engine: free-placed stamp colliders ===
      // The corescript may expose _agoniaStampRects() on the map, returning
      // impassable stamp rectangles {x,y,w,h} in tile units. Turn each into a
      // real collider so the pixel movement blocks stamps precisely (off-grid).
      if ( gameMap._agoniaStampRects ) {
        var __agoniaRects = gameMap._agoniaStampRects();
        for ( var __agoniaI = 0; __agoniaI < __agoniaRects.length; __agoniaI++ ) {
          var __ar = __agoniaRects[ __agoniaI ];
          colliders.push( Collider.createRect( __ar.x, __ar.y, __ar.w, __ar.h ) );
        }
      }

      var collisionMesh = Collider.createList();
      if ( colliders.length > 0 ) {
        Collider.addToList( collisionMesh, Collider.treeFromArray( colliders ) );
      }
      if ( hColliders.length > 0 ) {
        Collider.addToList( collisionMesh, Collider.treeFromArray( hColliders ) );
      }
      if ( vColliders.length > 0 ) {
        Collider.addToList( collisionMesh, Collider.treeFromArray( vColliders ) );
      }
      return collisionMesh;
    };


  } )();

  function Collider() {
    throw new Error( 'This is a static class' );
  }
  ( function() {

    Collider.CIRCLE = 0;
    Collider.POLYGON = 1;
    Collider.LIST = 2;
    Collider.PRECISION = Math.pow( 2, 7 );
    Collider.I_PRECISION = 1 / Collider.PRECISION;
    Collider.PRESETS = [];

    Collider.createList = function() {
      return { type: Collider.LIST, colliders: [], aabbox: { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY } };
    };

    Collider.addToList = function( list, collider ) {
      list.colliders.push( collider );
      list.aabbox.left = collider.aabbox.left < list.aabbox.left ? collider.aabbox.left : list.aabbox.left;
      list.aabbox.top = collider.aabbox.top < list.aabbox.top ? collider.aabbox.top : list.aabbox.top;
      list.aabbox.right = collider.aabbox.right > list.aabbox.right ? collider.aabbox.right : list.aabbox.right;
      list.aabbox.bottom = collider.aabbox.bottom > list.aabbox.bottom ? collider.aabbox.bottom : list.aabbox.bottom;
    };

    Collider.getPreset = function( id ) {
      if ( Collider.PRESETS.length === 0 ) {
        Collider.PRESETS[0] = Collider.null();
        for ( var ii = 0; ii < PRESETS.length; ii++ ) {
          var xmlDoc = DOM_PARSER.parseFromString( '<collider>' + JSON.parse( PRESETS[ii] ) + '</collider>', 'text/xml' );
          Collider.PRESETS[ii + 1] = Collider.createFromXML( xmlDoc );

          var childNodes = xmlDoc.childNodes[0].childNodes;
          for ( var jj = 0; jj < childNodes.length; jj++ ) {
            if ( childNodes[jj].nodeName === 'name' ) {
              Collider.PRESETS[childNodes[jj].innerHTML.trim()] = Collider.PRESETS[ii + 1];
              break;
            }
          }
        }
      }
      return Collider.PRESETS[id] || null;
    };

    Collider.createFromXML = function( xml ) {
      var xmlDoc = ( typeof xml === 'string' ? DOM_PARSER.parseFromString( xml, 'text/xml' ) : xml );
      var childNodes = xmlDoc.childNodes;
      for ( var ii = 0; ii < xmlDoc.childNodes.length; ii++ ) {
        if ( xmlDoc.childNodes[ii].nodeName === 'collider' ) {
          childNodes = xmlDoc.childNodes[ii].childNodes;
          break;
        }
      }
      var filterNodes = [];
      for ( var ii = 0; ii < childNodes.length; ii++ ) {
        switch ( childNodes[ii].nodeName ) {
        case 'rect':
        case 'circle':
        case 'line':
        case 'polygon':
        case 'regular':
          filterNodes.push( childNodes[ii] );
          break;
        }
      }
      childNodes = filterNodes;
      if ( childNodes.length === 0 ) {
        return Collider.null();
      } else if ( childNodes.length === 1 ) {
        switch ( childNodes[0].nodeName ) {
        case 'rect':
          var x = Number( childNodes[0].getAttribute( 'x' ) );
          var y = Number( childNodes[0].getAttribute( 'y' ) );
          var width = Number( childNodes[0].getAttribute( 'width' ) );
          var height = Number( childNodes[0].getAttribute( 'height' ) );
          return Collider.createRect( x, y, width, height );
        case 'circle':
          var cx = Number( childNodes[0].getAttribute( 'cx' ) );
          var cy = Number( childNodes[0].getAttribute( 'cy' ) );
          var r = Number( childNodes[0].getAttribute( 'r' ) );
          return Collider.createCircle( cx, cy, r );
        case 'line':
          var x1 = Number( childNodes[0].getAttribute( 'x1' ) );
          var y1 = Number( childNodes[0].getAttribute( 'y1' ) );
          var x2 = Number( childNodes[0].getAttribute( 'x2' ) );
          var y2 = Number( childNodes[0].getAttribute( 'y2' ) );
          return Collider.createLine( x1, y1, x2, y2 );
        case 'polygon':
          var points = childNodes[0].getAttribute( 'points' ).split( ' ' );
          for ( var jj = 0; jj < points.length; jj++ ) {
            points[jj] = points[jj].split( ',' );
            for ( var kk = 0; kk < points[jj].length; kk++ ) {
              points[jj][kk] = Number( points[jj][kk] );
            }
          }
          return Collider.createPolygon( points );
        case 'regular':
          var cx = Number( childNodes[0].getAttribute( 'cx' ) );
          var cy = Number( childNodes[0].getAttribute( 'cy' ) );
          var rx = Number( childNodes[0].getAttribute( 'rx' ) );
          var ry = Number( childNodes[0].getAttribute( 'ry' ) );
          var p = Number( childNodes[0].getAttribute( 'p' ) );
          return Collider.createRegularPolygon( cx, cy, rx, ry, p );
        }
      } else {
        var colliderList = Collider.createList();
        for ( var ii = 0; ii < childNodes.length; ii++ ) {
          switch ( childNodes[ii].nodeName ) {
          case 'rect':
            var x = Number( childNodes[ii].getAttribute( 'x' ) );
            var y = Number( childNodes[ii].getAttribute( 'y' ) );
            var width = Number( childNodes[ii].getAttribute( 'width' ) );
            var height = Number( childNodes[ii].getAttribute( 'height' ) );
            Collider.addToList( colliderList, Collider.createRect( x, y, width, height ) );
            break;
          case 'circle':
            var cx = Number( childNodes[ii].getAttribute( 'cx' ) );
            var cy = Number( childNodes[ii].getAttribute( 'cy' ) );
            var r = Number( childNodes[ii].getAttribute( 'r' ) );
            Collider.addToList( colliderList, Collider.createCircle( cx, cy, r ) );
            break;
          case 'line':
            var x1 = Number( childNodes[ii].getAttribute( 'x1' ) );
            var y1 = Number( childNodes[ii].getAttribute( 'y1' ) );
            var x2 = Number( childNodes[ii].getAttribute( 'x2' ) );
            var y2 = Number( childNodes[ii].getAttribute( 'y2' ) );
            Collider.addToList( colliderList, Collider.createLine( x1, y1, x2, y2 ) );
            break;
          case 'polygon':
            var points = childNodes[ii].getAttribute( 'points' ).split( ' ' );
            for ( var jj = 0; jj < points.length; jj++ ) {
              points[jj] = points[jj].split( ',' );
              for ( var kk = 0; kk < points[jj].length; kk++ ) {
                points[jj][kk] = Number( points[jj][kk] );
              }
            }
            Collider.addToList( colliderList, Collider.createPolygon( points ) );
            break;
          case 'regular':
            var cx = Number( childNodes[ii].getAttribute( 'cx' ) );
            var cy = Number( childNodes[ii].getAttribute( 'cy' ) );
            var rx = Number( childNodes[ii].getAttribute( 'rx' ) );
            var ry = Number( childNodes[ii].getAttribute( 'ry' ) );
            var p = Number( childNodes[ii].getAttribute( 'p' ) );
            Collider.addToList( colliderList, Collider.createRegularPolygon( cx, cy, rx, ry, p ) );
            break;
          }
        }
        return colliderList;
      }
    };

    Collider.createRect = function( x, y, width, height ) {
      return Collider.createPolygon( [
        [ x, y ],
        [ x + width, y ],
        [ x + width, y + height ],
        [ x, y + height ]
      ] );
    };

    Collider.createLine = function( x1, y1, x2, y2 ) {
      return Collider.createPolygon( [
        [ x1, y1 ],
        [ x2, y2 ],
      ] );
    };

    Collider.createCircle = function( x, y, radius ) {
      return { type: Collider.CIRCLE, x: x, y: y, radius: radius, aabbox: { left: x - radius, top: y - radius, right: x + radius, bottom: y + radius } };
    };

    Collider.createPolygon = function( vertices ) {
      var aabbox = {
        left: Number.POSITIVE_INFINITY,
        top: Number.POSITIVE_INFINITY,
        right: Number.NEGATIVE_INFINITY,
        bottom: Number.NEGATIVE_INFINITY,
      };
      vertices.forEach( function( vertex ) {
        if ( vertex[0] < aabbox.left ) { aabbox.left = vertex[0]; }
        if ( vertex[1] < aabbox.top ) { aabbox.top = vertex[1]; }
        if ( vertex[0] > aabbox.right ) { aabbox.right = vertex[0]; }
        if ( vertex[1] > aabbox.bottom ) { aabbox.bottom = vertex[1]; }
      } );
      return { type: Collider.POLYGON, vertices: vertices, aabbox: aabbox };
    };

    Collider.createRegularPolygon = function( x, y, sx, sy, points ) {
      if ( !points || points < 3 ) {
        return Collider.createCircle( x, y, Math.sqrt( sx * sx +  sy * sy ) );
      }
      var vertices = [];
      var divisor = points / ( Math.PI * 2 );
      var pi2 = Math.PI / 2;
      for ( var ii = 0; ii < points; ii++ ) {
        vertices.push( [ x + Math.cos( ii / divisor - pi2 ) * sx, y + Math.sin( ii / divisor - pi2 ) * sy ] );
      }
      return Collider.createPolygon( vertices );
    };

    Collider.null = function() {
      if ( !Collider._null ) {
        Collider._null = Collider.createPolygon( [] );
      }
      return Collider._null;
    };

    Collider.sharedTile = function() {
      if ( !Collider._sharedTile ) {
        Collider._sharedTile = Collider.createPolygon( [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ] );
      }
      return Collider._sharedTile;
    };

    Collider.sharedCircle = function() {
      if ( !Collider._sharedCircle ) {
        Collider._sharedCircle = Collider.createCircle( 0.5, 0.5, 0.5 );
      }
      return Collider._sharedCircle;
    };

    Collider.sharedCharacter = function() {
      if ( !Collider._sharedCharacter ) {
        Collider._sharedCharacter = Collider.createCircle( 0.5, 0.7, 0.25 );
      }
      return Collider._sharedCharacter;
    };

    Collider.sharedAirship = function() {
      if ( !Collider._sharedAirship ) {
        Collider._sharedAirship = Collider.createCircle( 0.5, 0.5, 0.25 );
      }
      return Collider._sharedAirship;
    };

    Collider.sharedShip = function() {
      if ( !Collider._sharedShip ) {
        Collider._sharedShip = Collider.createCircle( 0.5, 0.5, 0.5 );
      }
      return Collider._sharedShip;
    };

    Collider.sharedBoat = function() {
      if ( !Collider._sharedBoat ) {
        Collider._sharedBoat = Collider.createCircle( 0.5, 0.5, 1 / 3 );
      }
      return Collider._sharedBoat;
    };

    Collider.polygonsWithinColliderList = function( ax, ay, aabbox, bx, by, bc ) {
      var polygons = [];
      for ( var ii = 0; ii < bc.colliders.length; ii++ ) {
        if ( Collider.aabboxCheck( ax, ay, aabbox, bx, by, bc.colliders[ii].aabbox ) ) {
          if ( bc.colliders[ii].type === Collider.LIST ) {
            polygons = polygons.concat( Collider.polygonsWithinColliderList( ax, ay, aabbox, bx, by, bc.colliders[ii] ) );
          } else {
            polygons.push( bc.colliders[ii] );
          }
        }
      }
      return polygons;
    };

    Collider.encaseCircleCircle = function( ax, ay, ac, bx, by, bc ) {
      ax = ax + ac.x;
      ay = ay + ac.y;
      bx = bx + bc.x;
      by = by + bc.y;

      var dx = ax - bx;
      var dy = ay - by;
      var dd = dx * dx + dy * dy;
      dd -= ( bc.radius * bc.radius );
      if ( dd < ac.radius * ac.radius ) {
        return true;
      }
      return false;
    };

    Collider.intersectCircleCircle = function( ax, ay, ac, bx, by, bc ) {
      ax = ax + ac.x;
      ay = ay + ac.y;
      bx = bx + bc.x;
      by = by + bc.y;

      var dx = ax - bx;
      var dy = ay - by;
      var dd = dx * dx + dy * dy;
      var rr = bc.radius + ac.radius;
      if ( dd < rr * rr ) {
        return true;
      }
      return false;
    };

    Collider.moveCircleCircle = function( ax, ay, ac, bx, by, bc, vector ) {
      ax = ax + ac.x;
      ay = ay + ac.y;
      bx = bx + bc.x;
      by = by + bc.y;

      var dx = ax + vector.x - bx;
      var dy = ay + vector.y - by;
      var dd = dx * dx + dy * dy;
      var rr = bc.radius + ac.radius;
      if ( dd < rr * rr ) {
        dd = rr - Math.sqrt( dd );
        var dl = Math.sqrt( dx * dx + dy * dy );
        vector.x += ( dx / dl ) * dd;
        vector.y += ( dy / dl ) * dd;
      }
      return vector;
    };

    Collider.encaseCirclePolygon = function( ax, ay, ac, bx, by, bc ) {
      var aradius = ac.radius + Collider.I_PRECISION;
      ax = ax + ac.x;
      ay = ay + ac.y;

      var closestPoint = {
        distance: Number.POSITIVE_INFINITY,
      };
      for ( var ii = 0; ii < bc.vertices.length; ii++ ) {
        var dx = ( ax ) - ( bx + bc.vertices[ii][0] );
        var dy = ( ay ) - ( by + bc.vertices[ii][1] );
        var d = dx * dx + dy * dy;
        if ( d < closestPoint.distance ) {
          closestPoint.dx = dx;
          closestPoint.dy = dy;
          closestPoint.distance = d;
          closestPoint.index = ii;
        }
      }

      var planeX = closestPoint.dx;
      var planeY = closestPoint.dy;
      var length = Math.sqrt( planeX * planeX + planeY * planeY );
      planeX /= length;
      planeY /= length;

      var point = planeX * ( ax ) + planeY * ( ay );
      var maxA = point + aradius;
      var minA = point - aradius;

      var minB = Number.POSITIVE_INFINITY;
      var maxB = Number.NEGATIVE_INFINITY;
      for ( var ii = 0; ii < bc.vertices.length; ii++ ) {
          var projection = planeX * ( bx + bc.vertices[ii][0] ) + planeY * ( by + bc.vertices[ii][1] );
          if ( projection < minB ) minB = projection;
          if ( projection > maxB ) maxB = projection;
      }

      if ( minB < minA || maxB > maxA ) {
        return false;
      }

      var jj;
      for ( var ii = 0; ii < bc.vertices.length; ii++ ) {
        jj = ii + 1;
        if ( jj == bc.vertices.length ) {
          jj = 0;
        }

        var planeX = bc.vertices[jj][1] - bc.vertices[ii][1];
        var planeY = bc.vertices[ii][0] - bc.vertices[jj][0];
        var length = Math.sqrt( planeX * planeX + planeY * planeY );
        planeX /= length;
        planeY /= length;

        var point = planeX * ( ax ) + planeY * ( ay );
        var maxA = point + aradius;
        var minA = point - aradius;

        var minB = Number.POSITIVE_INFINITY;
        var maxB = Number.NEGATIVE_INFINITY;
        for ( var kk = 0; kk < bc.vertices.length; kk++ ) {
            var projection = planeX * ( bx + bc.vertices[kk][0] ) + planeY * ( by + bc.vertices[kk][1] );
            if ( projection < minB ) minB = projection;
            if ( projection > maxB ) maxB = projection;
        }

        if ( minB < minA || maxB > maxA ) {
          return false;
        }
      }

      return true;
    };

    Collider.intersectCirclePolygon = function( ax, ay, ac, bx, by, bc ) {
      var aradius = ac.radius;
      ax = ax + ac.x;
      ay = ay + ac.y;

      var closestPoint = {
        distance: Number.POSITIVE_INFINITY,
      };
      for ( var ii = 0; ii < bc.vertices.length; ii++ ) {
        var dx = ( ax ) - ( bx + bc.vertices[ii][0] );
        var dy = ( ay ) - ( by + bc.vertices[ii][1] );
        var d = dx * dx + dy * dy;
        if ( d < closestPoint.distance ) {
          closestPoint.dx = dx;
          closestPoint.dy = dy;
          closestPoint.distance = d;
          closestPoint.index = ii;
        }
      }

      var planeX = closestPoint.dx;
      var planeY = closestPoint.dy;
      var length = Math.sqrt( planeX * planeX + planeY * planeY );
      planeX /= length;
      planeY /= length;

      var point = planeX * ( ax ) + planeY * ( ay );
      var maxA = point + aradius;
      var minA = point - aradius;

      var minB = Number.POSITIVE_INFINITY;
      var maxB = Number.NEGATIVE_INFINITY;
      for ( var ii = 0; ii < bc.vertices.length; ii++ ) {
          var projection = planeX * ( bx + bc.vertices[ii][0] ) + planeY * ( by + bc.vertices[ii][1] );
          if ( projection < minB ) minB = projection;
          if ( projection > maxB ) maxB = projection;
      }

      if ( minA >= maxB || maxA <= minB ) {
        return false;
      }

      var jj;
      for ( var ii = 0; ii < bc.vertices.length; ii++ ) {
        jj = ii + 1;
        if ( jj == bc.vertices.length ) {
          jj = 0;
        }

        var planeX = bc.vertices[jj][1] - bc.vertices[ii][1];
        var planeY = bc.vertices[ii][0] - bc.vertices[jj][0];
        var length = Math.sqrt( planeX * planeX + planeY * planeY );
        planeX /= length;
        planeY /= length;

        var point = planeX * ( ax ) + planeY * ( ay );
        var maxA = point + aradius;
        var minA = point - aradius;

        var minB = Number.POSITIVE_INFINITY;
        var maxB = Number.NEGATIVE_INFINITY;
        for ( var kk = 0; kk < bc.vertices.length; kk++ ) {
            var projection = planeX * ( bx + bc.vertices[kk][0] ) + planeY * ( by + bc.vertices[kk][1] );
            if ( projection < minB ) minB = projection;
            if ( projection > maxB ) maxB = projection;
        }

        if ( minA > maxB || maxA < minB ) {
          return false;
        }
      }

      return true;
    };

    Collider.moveCirclePolygon = function( ax, ay, ac, bx, by, bc, vector ) {
      var aradius = ac.radius;
      ax = ax + ac.x;
      ay = ay + ac.y;

      var closestPoint = {
        distance: Number.POSITIVE_INFINITY,
      };
      for ( var ii = 0; ii < bc.vertices.length; ii++ ) {
        var dx = ( ax + vector.x ) - ( bx + bc.vertices[ii][0] );
        var dy = ( ay + vector.y ) - ( by + bc.vertices[ii][1] );
        var d = dx * dx + dy * dy;
        if ( d < closestPoint.distance ) {
          closestPoint.dx = dx;
          closestPoint.dy = dy;
          closestPoint.distance = d;
          closestPoint.index = ii;
        }
      }

      var correctionDistance;
      var correctionX;
      var correctionY;
      var absDistance;

      var planeX = closestPoint.dx;
      var planeY = closestPoint.dy;
      var length = Math.sqrt( planeX * planeX + planeY * planeY );
      planeX /= length;
      planeY /= length;

      var point = planeX * ( ax + vector.x ) + planeY * ( ay + vector.y );
      var maxA = point + aradius;
      var minA = point - aradius;

      var minB = Number.POSITIVE_INFINITY;
      var maxB = Number.NEGATIVE_INFINITY;
      for ( var ii = 0; ii < bc.vertices.length; ii++ ) {
          var projection = planeX * ( bx + bc.vertices[ii][0] ) + planeY * ( by + bc.vertices[ii][1] );
          if ( projection < minB ) minB = projection;
          if ( projection > maxB ) maxB = projection;
      }

      if ( minA > maxB || maxA < minB ) {
        return vector;
      }

      correctionDistance = maxB - minA;
      correctionX = planeX;
      correctionY = planeY;
      absDistance = Math.abs( correctionDistance );

      var jj;
      for ( var ii = 0; ii < bc.vertices.length; ii++ ) {
        jj = ii + 1;
        if ( jj == bc.vertices.length ) {
          jj = 0;
        }

        var planeX = bc.vertices[jj][1] - bc.vertices[ii][1];
        var planeY = bc.vertices[ii][0] - bc.vertices[jj][0];
        var length = Math.sqrt( planeX * planeX + planeY * planeY );
        planeX /= length;
        planeY /= length;

        var point = planeX * ( ax + vector.x ) + planeY * ( ay + vector.y );
        var maxA = point + aradius;
        var minA = point - aradius;

        var minB = Number.POSITIVE_INFINITY;
        var maxB = Number.NEGATIVE_INFINITY;
        for ( var kk = 0; kk < bc.vertices.length; kk++ ) {
            var projection = planeX * ( bx + bc.vertices[kk][0] ) + planeY * ( by + bc.vertices[kk][1] );
            if ( projection < minB ) minB = projection;
            if ( projection > maxB ) maxB = projection;
        }

        if ( minA > maxB || maxA < minB ) {
          return vector;
        }

        var distance = maxB - minA;
        var gap = Math.abs( distance );
        if ( gap < absDistance ) {
          correctionDistance = distance;
          correctionX = planeX;
          correctionY = planeY;
          absDistance = gap;
        }
      }

      vector.x += correctionX * correctionDistance;
      vector.y += correctionY * correctionDistance;

      return vector;
    };

    Collider.encasePolygonCircle = function( bx, by, bc, ax, ay, ac ) {
      var aradius = ac.radius - Collider.I_PRECISION;
      ax = ax + ac.x;
      ay = ay + ac.y;

      var closestPoint = {
        distance: Number.POSITIVE_INFINITY,
      };
      for ( var ii = 0; ii < bc.vertices.length; ii++ ) {
        var dx = ( ax ) - ( bx + bc.vertices[ii][0] );
        var dy = ( ay ) - ( by + bc.vertices[ii][1] );
        var d = dx * dx + dy * dy;
        if ( d < closestPoint.distance ) {
          closestPoint.dx = dx;
          closestPoint.dy = dy;
          closestPoint.distance = d;
          closestPoint.index = ii;
        }
      }

      var planeX = closestPoint.dx;
      var planeY = closestPoint.dy;
      var length = Math.sqrt( planeX * planeX + planeY * planeY );
      planeX /= length;
      planeY /= length;

      var point = planeX * ( ax ) + planeY * ( ay );
      var maxA = point + aradius;
      var minA = point - aradius;

      var minB = Number.POSITIVE_INFINITY;
      var maxB = Number.NEGATIVE_INFINITY;
      for ( var ii = 0; ii < bc.vertices.length; ii++ ) {
          var projection = planeX * ( bx + bc.vertices[ii][0] ) + planeY * ( by + bc.vertices[ii][1] );
          if ( projection < minB ) minB = projection;
          if ( projection > maxB ) maxB = projection;
      }

      if ( minA < minB || maxA > maxB ) {
        return false;
      }

      var jj;
      for ( var ii = 0; ii < bc.vertices.length; ii++ ) {
        jj = ii + 1;
        if ( jj == bc.vertices.length ) {
          jj = 0;
        }

        var planeX = bc.vertices[jj][1] - bc.vertices[ii][1];
        var planeY = bc.vertices[ii][0] - bc.vertices[jj][0];
        var length = Math.sqrt( planeX * planeX + planeY * planeY );
        planeX /= length;
        planeY /= length;

        var point = planeX * ( ax ) + planeY * ( ay );
        var maxA = point + aradius;
        var minA = point - aradius;

        var minB = Number.POSITIVE_INFINITY;
        var maxB = Number.NEGATIVE_INFINITY;
        for ( var kk = 0; kk < bc.vertices.length; kk++ ) {
            var projection = planeX * ( bx + bc.vertices[kk][0] ) + planeY * ( by + bc.vertices[kk][1] );
            if ( projection < minB ) minB = projection;
            if ( projection > maxB ) maxB = projection;
        }

        if ( minA < minB || maxA > maxB ) {
          return false;
        }
      }

      return true;
    };

    Collider.intersectPolygonCircle = function( ax, ay, ac, bx, by, bc ) {
      return Collider.intersectCirclePolygon( bx, by, bc, ax, ay, ac );
    };

    Collider.movePolygonCircle = function( ax, ay, ac, bx, by, bc, vector ) {
      var ivector = {
        x: -vector.x,
        y: -vector.y,
      };
      ivector = Collider.moveCirclePolygon( bx, by, bc, ax, ay, ac, ivector );
      vector.x = -ivector.x;
      vector.y = -ivector.y;
      return vector;
    };

    Collider.encasePolygonPolygon = function( ax, ay, ac, bx, by, bc ) {
      var jj;
      var colliders = [ bc, ac ];
      for ( var cc = 0; cc < 2; cc++ ) {
        for ( var ii = 0; ii < colliders[cc].vertices.length; ii++ ) {
          jj = ii + 1;
          if ( jj == colliders[cc].vertices.length ) {
            jj = 0;
          }

          var planeX = colliders[cc].vertices[jj][1] - colliders[cc].vertices[ii][1];
          var planeY = colliders[cc].vertices[ii][0] - colliders[cc].vertices[jj][0];
          var length = Math.sqrt( planeX * planeX + planeY * planeY );
          planeX /= length;
          planeY /= length;

          var minA = Number.POSITIVE_INFINITY;
          var maxA = Number.NEGATIVE_INFINITY;
          for ( var kk = 0; kk < ac.vertices.length; kk++ ) {
              var projection = planeX * ( ax + ac.vertices[kk][0] ) + planeY * ( ay + ac.vertices[kk][1] );
              if ( projection < minA ) minA = projection;
              if ( projection > maxA ) maxA = projection;
          }

          var minB = Number.POSITIVE_INFINITY;
          var maxB = Number.NEGATIVE_INFINITY;
          for ( var kk = 0; kk < bc.vertices.length; kk++ ) {
              var projection = planeX * ( bx + bc.vertices[kk][0] ) + planeY * ( by + bc.vertices[kk][1] );
              if ( projection < minB ) minB = projection;
              if ( projection > maxB ) maxB = projection;
          }

          if ( minB < minA || maxB > maxA ) {
            return false;
          }
        }
      }

      return true;
    };

    Collider.intersectPolygonPolygon = function( ax, ay, ac, bx, by, bc ) {
      var jj;
      var colliders = [ bc, ac ];
      for ( var cc = 0; cc < 2; cc++ ) {
        for ( var ii = 0; ii < colliders[cc].vertices.length; ii++ ) {
          jj = ii + 1;
          if ( jj == colliders[cc].vertices.length ) {
            jj = 0;
          }

          var planeX = colliders[cc].vertices[jj][1] - colliders[cc].vertices[ii][1];
          var planeY = colliders[cc].vertices[ii][0] - colliders[cc].vertices[jj][0];
          var length = Math.sqrt( planeX * planeX + planeY * planeY );
          planeX /= length;
          planeY /= length;

          var minA = Number.POSITIVE_INFINITY;
          var maxA = Number.NEGATIVE_INFINITY;
          for ( var kk = 0; kk < ac.vertices.length; kk++ ) {
              var projection = planeX * ( ax + ac.vertices[kk][0] ) + planeY * ( ay + ac.vertices[kk][1] );
              if ( projection < minA ) minA = projection;
              if ( projection > maxA ) maxA = projection;
          }

          var minB = Number.POSITIVE_INFINITY;
          var maxB = Number.NEGATIVE_INFINITY;
          for ( var kk = 0; kk < bc.vertices.length; kk++ ) {
              var projection = planeX * ( bx + bc.vertices[kk][0] ) + planeY * ( by + bc.vertices[kk][1] );
              if ( projection < minB ) minB = projection;
              if ( projection > maxB ) maxB = projection;
          }

          if ( minA > maxB || maxA < minB ) {
            return false;
          }
        }
      }

      return true;
    };

    Collider.movePolygonPolygon = function( ax, ay, ac, bx, by, bc, vector ) {
      var correctionDistance;
      var correctionX;
      var correctionY;
      var absDistance = Number.POSITIVE_INFINITY;

      var jj;
      var colliders = [ bc, ac ];
      for ( var cc = 0; cc < 2; cc++ ) {
        for ( var ii = 0; ii < colliders[cc].vertices.length; ii++ ) {
          jj = ii + 1;
          if ( jj == colliders[cc].vertices.length ) {
            jj = 0;
          }

          var planeX = colliders[cc].vertices[jj][1] - colliders[cc].vertices[ii][1];
          var planeY = colliders[cc].vertices[ii][0] - colliders[cc].vertices[jj][0];
          var length = Math.sqrt( planeX * planeX + planeY * planeY );
          planeX /= length;
          planeY /= length;

          var minA = Number.POSITIVE_INFINITY;
          var maxA = Number.NEGATIVE_INFINITY;
          for ( var kk = 0; kk < ac.vertices.length; kk++ ) {
              var projection = planeX * ( ax + vector.x + ac.vertices[kk][0] ) + planeY * ( ay + vector.y + ac.vertices[kk][1] );
              if ( projection < minA ) minA = projection;
              if ( projection > maxA ) maxA = projection;
          }

          var minB = Number.POSITIVE_INFINITY;
          var maxB = Number.NEGATIVE_INFINITY;
          for ( var kk = 0; kk < bc.vertices.length; kk++ ) {
              var projection = planeX * ( bx + bc.vertices[kk][0] ) + planeY * ( by + bc.vertices[kk][1] );
              if ( projection < minB ) minB = projection;
              if ( projection > maxB ) maxB = projection;
          }

          if ( minA > maxB || maxA < minB ) {
            return vector;
          }

          var distance = maxB - minA;
          var gap = Math.abs( distance );
          if ( gap < absDistance ) {
            correctionDistance = distance;
            correctionX = planeX;
            correctionY = planeY;
            absDistance = gap;
          }
        }
      }

      vector.x += correctionX * correctionDistance;
      vector.y += correctionY * correctionDistance;

      return vector;
    };

    Collider.encase = function( ax, ay, ac, bx, by, bc ) {
      if ( ac.type == Collider.LIST ) {
        for ( var ii = 0; ii < ac.colliders.length; ii++ ) {
          if ( Collider.encase( ax, ay, ac.colliders[ii], bx, by, bc ) ) {
            return true;
          }
        }
        return false;
      }

      if ( bc.type == Collider.LIST ) {
        for ( var ii = 0; ii < bc.colliders.length; ii++ ) {
          if ( Collider.encase( ax, ay, ac, bx, by, bc.colliders[ii] ) ) {
            return true;
          }
        }
        return false;
      }

      if ( ac.type == Collider.CIRCLE && bc.type == Collider.CIRCLE ) {
        return Collider.encaseCircleCircle( ax, ay, ac, bx, by, bc );
      }
      if ( ac.type == Collider.CIRCLE && bc.type == Collider.POLYGON ) {
        return Collider.encaseCirclePolygon( ax, ay, ac, bx, by, bc );
      }
      if ( ac.type == Collider.POLYGON && bc.type == Collider.CIRCLE ) {
        return Collider.encasePolygonCircle( ax, ay, ac, bx, by, bc );
      }
      if ( ac.type == Collider.POLYGON && bc.type == Collider.POLYGON ) {
        return Collider.encasePolygonPolygon( ax, ay, ac, bx, by, bc );
      }

      return false;
    };

    Collider.intersect = function( ax, ay, ac, bx, by, bc ) {
      if ( ac.type == Collider.LIST ) {
        for ( var ii = 0; ii < ac.colliders.length; ii++ ) {
          if ( Collider.intersect( ax, ay, ac.colliders[ii], bx, by, bc ) ) {
            return true;
          }
        }
        return false;
      }

      if ( bc.type == Collider.LIST ) {
        for ( var ii = 0; ii < bc.colliders.length; ii++ ) {
          if ( Collider.intersect( ax, ay, ac, bx, by, bc.colliders[ii] ) ) {
            return true;
          }
        }
        return false;
      }

      if ( ac.type == Collider.CIRCLE && bc.type == Collider.CIRCLE ) {
        return Collider.intersectCircleCircle( ax, ay, ac, bx, by, bc );
      }
      if ( ac.type == Collider.CIRCLE && bc.type == Collider.POLYGON ) {
        return Collider.intersectCirclePolygon( ax, ay, ac, bx, by, bc );
      }
      if ( ac.type == Collider.POLYGON && bc.type == Collider.CIRCLE ) {
        return Collider.intersectPolygonCircle( ax, ay, ac, bx, by, bc );
      }
      if ( ac.type == Collider.POLYGON && bc.type == Collider.POLYGON ) {
        return Collider.intersectPolygonPolygon( ax, ay, ac, bx, by, bc );
      }

      return false;
    };

    Collider.move = function( ax, ay, ac, bx, by, bc, vector ) {
      if ( ac.type == Collider.LIST ) {
        for ( var ii = 0; ii < ac.colliders.length; ii++ ) {
          vector = Collider.move( ax, ay, ac.colliders[ii], bx, by, bc, vector );
          if ( vector.x === 0 && vector.y === 0 ) {
            break;
          }
        }
        return vector;
      }

      if ( bc.type == Collider.LIST ) {
        for ( var ii = 0; ii < bc.colliders.length; ii++ ) {
          vector = Collider.move( ax, ay, ac, bx, by, bc.colliders[ii], vector );
          if ( vector.x === 0 && vector.y === 0 ) {
            break;
          }
        }
        return vector;
      }

      if ( ac.type == Collider.CIRCLE && bc.type == Collider.CIRCLE ) {
        return Collider.moveCircleCircle( ax, ay, ac, bx, by, bc, vector );
      }
      if ( ac.type == Collider.CIRCLE && bc.type == Collider.POLYGON ) {
        return Collider.moveCirclePolygon( ax, ay, ac, bx, by, bc, vector );
      }
      if ( ac.type == Collider.POLYGON && bc.type == Collider.CIRCLE ) {
        return Collider.movePolygonCircle( ax, ay, ac, bx, by, bc, vector );
      }
      if ( ac.type == Collider.POLYGON && bc.type == Collider.POLYGON ) {
        return Collider.movePolygonPolygon( ax, ay, ac, bx, by, bc, vector );
      }

      return vector;
    };

    Collider.treeFromArray = function( colliders ) {
      while ( colliders.length > 1 ) {
        var shortestDist = Number.POSITIVE_INFINITY;
        var closestNode = -1;
        for ( var ii = 1; ii < colliders.length; ii++ ) {
          var leftDistance = Math.abs( colliders[ii].aabbox.right - colliders[0].aabbox.left );
          if ( leftDistance < shortestDist ) {
            shortestDist = leftDistance;
            closestNode = ii;
            continue;
          }

          var rightDistance = Math.abs( colliders[ii].aabbox.left - colliders[0].aabbox.right );
          if ( rightDistance < shortestDist ) {
            shortestDist = rightDistance;
            closestNode = ii;
            continue;
          }

          var topDistance = Math.abs( colliders[ii].aabbox.bottom - colliders[0].aabbox.top );
          if ( topDistance < shortestDist ) {
            shortestDist = topDistance;
            closestNode = ii;
            continue;
          }

          var bottomDistance = Math.abs( colliders[ii].aabbox.top - colliders[0].aabbox.bottom );
          if ( bottomDistance < shortestDist ) {
            shortestDist = bottomDistance;
            closestNode = ii;
            continue;
          }
        }

        var pair = Collider.createList();
        Collider.addToList( pair, colliders[0] );
        Collider.addToList( pair, colliders[closestNode] );
        colliders.splice( closestNode, 1 );
        colliders[0] = pair;
      }

      return colliders[0];
    };

    Collider.aabboxCheck = function( ax, ay, ac, bx, by, bc, vx, vy ) {
      vx = vx || 0;
      vy = vy || 0;
      var left = ax + ac.left + ( vx < 0 ? vx : 0 );
      if ( left > bx + bc.right ) {
        return false;
      }

      var top = ay + ac.top + ( vy < 0 ? vy : 0 );
      if ( top > by + bc.bottom ) {
        return false;
      }

      var right = ax + ac.right + ( vx > 0 ? vx : 0 );
      if ( right < bx + bc.left ) {
        return false;
      }

      var bottom = ay + ac.bottom + ( vy > 0 ? vy : 0 );
      if ( bottom < by + bc.top ) {
        return false;
      }

      return true;
    };

  } )();
CollisionMesh.collectColliders = function(mesh, out) {
  if (!mesh) return out;
  out = out || [];
  if (mesh.type === Collider.LIST) {
    for (var i = 0; i < mesh.colliders.length; i++) CollisionMesh.collectColliders(mesh.colliders[i], out);
  } else { out.push(mesh); }
  return out;
};
