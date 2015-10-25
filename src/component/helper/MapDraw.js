/**
 * @module echarts/component/helper/MapDraw
 */
define(function (require) {

    var RoamController = require('./RoamController');
    var graphic = require('../../util/graphic');
    var zrUtil = require('zrender/core/util');

    function getFixedItemStyle(model, scale) {
        var itemStyle = model.getItemStyle();
        var areaColor = model.get('areaColor');
        if (areaColor) {
            itemStyle.fill = areaColor;
        }
        itemStyle.lineWidth && (itemStyle.lineWidth /= scale[0]);

        return itemStyle;
    }

    function updateMapSelectHandler(mapOrGeoModel, data, group) {
        mapOrGeoModel.get('selectedMode')
            ? group.on('click', function (e) {
                var dataIndex = e.target.dataIndex;
                if (dataIndex != null) {
                    var name = data.getName(dataIndex);
                    mapOrGeoModel.toggleSelected(name);

                    updateMapSelected(mapOrGeoModel, data);
                }
            })
            : group.off('click');
    };

    function updateMapSelected(mapOrGeoModel, data) {
        data.eachItemGraphicEl(function (el, idx) {
            var name = data.getName(idx);
            el.trigger(mapOrGeoModel.isSelected(name) ? 'emphasis' : 'normal');
        });
    }

    /**
     * @alias module:echarts/component/helper/MapDraw
     * @param {module:echarts/ExtensionAPI} api
     * @param {boolean} updateGroup
     */
    function MapDraw(api, updateGroup) {

        var group = new graphic.Group();

        this._controller = new RoamController(
            api.getZr(), updateGroup ? group : null, null
        );

        this.group = group;
    }

    MapDraw.prototype = {

        constructor: MapDraw,

        draw: function (mapOrGeoModel, ecModel, api) {

            // geoModel has no data
            var data = mapOrGeoModel.getData && mapOrGeoModel.getData();

            var geo = mapOrGeoModel.coordinateSystem;

            var group = this.group;
            group.removeAll();

            var scale = geo.scale;
            group.position = geo.position.slice();
            group.scale = scale.slice();

            var itemStyleModel;
            var hoverItemStyleModel;
            var itemStyle;
            var hoverItemStyle;

            var itemStyleAccessPath = ['itemStyle', 'normal'];
            var hoverItemStyleAccessPath = ['itemStyle', 'emphasis'];
            if (!data) {
                itemStyleModel = mapOrGeoModel.getModel(itemStyleAccessPath);
                hoverItemStyleModel = mapOrGeoModel.getModel(hoverItemStyleAccessPath);

                itemStyle = getFixedItemStyle(itemStyleModel, scale);
                hoverItemStyle = getFixedItemStyle(hoverItemStyleModel, scale);
            }

            zrUtil.each(geo.regions, function (region) {

                var regionGroup = new graphic.Group();

                // Use the itemStyle in data if has data
                if (data) {
                    var dataIdx = data.indexOfName(region.name);
                    var itemModel = data.getItemModel(dataIdx);

                    // Only visual color of each item will be used. It can be encoded by dataRange
                    // But visual color of series is used in symbol drawing
                    var visualColor = data.getItemVisual(dataIdx, 'color', true);

                    itemStyleModel = itemModel.getModel(itemStyleAccessPath);
                    hoverItemStyleModel = itemModel.getModel(hoverItemStyleAccessPath);

                    itemStyle = getFixedItemStyle(itemStyleModel, scale);
                    hoverItemStyle = getFixedItemStyle(hoverItemStyleModel, scale);

                    if (visualColor) {
                        itemStyle.fill = visualColor;
                    }
                }

                zrUtil.each(region.contours, function (contour) {

                    var polygon = new graphic.Polygon({
                        shape: {
                            points: contour
                        }
                    });

                    polygon.setStyle(itemStyle);

                    regionGroup.add(polygon);
                });

                // setItemGraphicEl, setHoverStyle after all polygons are added to the rigionGroup
                data.setItemGraphicEl(dataIdx, regionGroup);

                graphic.setHoverStyle(regionGroup, hoverItemStyle);

                group.add(regionGroup);
            });

            this._updateController(mapOrGeoModel, ecModel, api);

            data && updateMapSelectHandler(mapOrGeoModel, data, group);

            updateMapSelected(mapOrGeoModel, data);
        },

        _updateController: function (mapOrGeoModel, ecModel, api) {
            var geo = mapOrGeoModel.coordinateSystem;
            var controller = this._controller;
            // FIXME mainType, subType 作为 component 的属性？
            var mainType = mapOrGeoModel.type.split('.')[0];
            controller.off('pan')
                .on('pan', function (dx, dy) {
                    api.dispatch({
                        type: 'geoRoam',
                        component: mainType,
                        name: mapOrGeoModel.name,
                        dx: dx,
                        dy: dy
                    });
                });
            controller.off('zoom')
                .on('zoom', function (wheelDelta, mouseX, mouseY) {
                    api.dispatch({
                        type: 'geoRoam',
                        component: mainType,
                        name: mapOrGeoModel.name,
                        zoom: wheelDelta,
                        originX: mouseX,
                        originY: mouseY
                    });

                    // TODO Update lineWidth
                });

            controller.rect = geo.getViewBox();
        }
    }

    return MapDraw;
});