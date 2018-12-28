/* Copyright 2018 Tecnativa - David Vidal
   License LGPL-3.0 or later (https://www.gnu.org/licenses/lgpl). */

odoo.define("pos_lot_selection.models", function (require) {
    "use strict";

    var models = require("point_of_sale.models");
    var session = require("web.session");

    models.PosModel = models.PosModel.extend({
        get_lot: function (product, location_id) {
            var done = new $.Deferred();
            session.rpc("/web/dataset/search_read", {
                "model": "stock.quant",
                "domain": [
                    ["location_id", "=", location_id],
                    ["product_id", "=", product],
                    ["lot_id", "!=", false]]
            }, {'async': false}).then(function (result) {
                var product_lot = {};
                if (result.length) {
                    for (var i = 0; i < result.length; i++) {
                        if (product_lot[result.records[i].lot_id[1]]) {
                            product_lot[result.records[i].lot_id[1]] += result.records[i].quantity;
                        } else {
                            product_lot[result.records[i].lot_id[1]] = result.records[i].quantity;
                        }
                    }
                }
                done.resolve(product_lot);
            });
            return done;
        },
    });

    var _orderline_super = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        compute_lot_lines: function(){
            var done = new $.Deferred();
            var compute_lot_lines = _orderline_super.compute_lot_lines.apply(this, arguments);
            this.pos.get_lot(this.product.id, this.pos.config.stock_location_id[0])
                .then(function (product_lot) {
                    var lot_name = Object.keys(product_lot);
                    for (var i = 0; i < lot_name.length; i++) {
                        if (product_lot[lot_name[i]] < compute_lot_lines.order_line.quantity) {
                            lot_name.splice(i, 1);
                        }
                    }
                    compute_lot_lines.lot_name = lot_name;
                    done.resolve(compute_lot_lines);
                });
            return compute_lot_lines;
        },
    });

});

var LocalNumpadWidget = PosBaseWidget.extend({
    template:'NumpadWidget',
    init: function(parent) {
        this._super(parent);
        this.state = new models.NumpadState();
    },
    start: function() {
        this.applyAccessRights();
        this.state.bind('change:mode', this.changedMode, this);
        this.pos.bind('change:cashier', this.applyAccessRights, this);
        this.changedMode();
        this.$el.find('.numpad-backspace').click(_.bind(this.clickDeleteLastChar, this));
        this.$el.find('.number-char').click(_.bind(this.clickAppendNewChar, this));
        this.$el.find('.mode-button').click(_.bind(this.clickChangeMode, this));
        var cashier = this.pos.get('cashier') || this.pos.get_cashier();
        if(cashier.role == 'manager'){
            this.$el.find('.numpad-minus').click(_.bind(this.clickSwitchSign, this));
        }
    },
    applyAccessRights: function() {
        var cashier = this.pos.get('cashier') || this.pos.get_cashier();
        var has_price_control_rights = !this.pos.config.restrict_price_control || cashier.role == 'manager';
        this.$el.find('.mode-button[data-mode="price"]')
            .toggleClass('disabled-mode', !has_price_control_rights)
            .prop('disabled', !has_price_control_rights);
        if (!has_price_control_rights && this.state.get('mode')=='price'){
            this.state.changeMode('quantity');
        }
    },
    clickDeleteLastChar: function() {
        return this.state.deleteLastChar();
    },
    clickSwitchSign: function() {
        return this.state.switchSign();
    },
    clickAppendNewChar: function(event) {
        var newChar;
        newChar = event.currentTarget.innerText || event.currentTarget.textContent;
        return this.state.appendNewChar(newChar);
    },
    clickChangeMode: function(event) {
        var newMode = event.currentTarget.attributes['data-mode'].nodeValue;
        return this.state.changeMode(newMode);
    },
    changedMode: function() {
        var mode = this.state.get('mode');
        $('.selected-mode').removeClass('selected-mode');
        $(_.str.sprintf('.mode-button[data-mode="%s"]', mode), this.$el).addClass('selected-mode');
    },
});

