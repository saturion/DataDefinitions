pimcore.registerNS('pimcore.plugin.advancedimportexport.definition.item');

pimcore.plugin.advancedimportexport.definition.item = Class.create({

    iconCls : 'advancedimportexport_icon_definition',
    url : {
        save : '/plugin/AdvancedImportExport/admin_definition/save'
    },

    providers : [],

    initialize: function (parentPanel, data, panelKey, type) {
        this.parentPanel = parentPanel;
        this.data = data;
        this.panelKey = panelKey;
        this.type = type;

        this.initPanel();
    },

    initPanel: function () {
        this.panel = this.getPanel();

        this.panel.on('beforedestroy', function () {
            delete this.parentPanel.panels[this.panelKey];
        }.bind(this));

        this.parentPanel.getTabPanel().add(this.panel);
        this.parentPanel.getTabPanel().setActiveItem(this.panel);
    },

    destroy : function () {
        if (this.panel) {
            this.panel.destroy();
        }
    },

    activate : function () {
        this.parentPanel.getTabPanel().setActiveItem(this.panel);
    },

    getPanel: function () {
        var panel = new Ext.TabPanel({
            activeTab: 0,
            title: this.data.name,
            closable: true,
            deferredRender: false,
            forceLayout: true,
            iconCls : this.iconCls,
            buttons: [{
                text: t('save'),
                iconCls: 'pimcore_icon_apply',
                handler: this.save.bind(this)
            }],
            items: this.getItems()
        });

        return panel;
    },

    getItems : function () {
        return [
            this.getSettings(),
            this.getProviderSettings(),
            this.getMappingSettings()
        ];
    },

    getSettings : function () {

        var classesStore = new Ext.data.JsonStore({
            autoDestroy: true,
            proxy: {
                type: 'ajax',
                url: '/admin/class/get-tree'
            },
            fields: ["text"]
        });
        classesStore.load();

        this.configForm = new Ext.form.Panel({
            bodyStyle: 'padding:10px;',
            title : t('settings'),
            autoScroll: true,
            defaults : {
                labelWidth : 200
            },
            border:false,
            items: [
                {
                    xtype : 'combo',
                    fieldLabel: t("advancedimportexport_provider"),
                    name: "provider",
                    displayField: "provider",
                    valueField: "provider",
                    store: pimcore.globalmanager.get("advancedimportexport_providers"),
                    value : this.data.provider,
                    width: 500,
                    listeners : {
                        change : function (combo, value) {
                            this.data.provider = value;
                            this.reloadProviderSettings();
                            this.reloadColumnMapping();
                        }.bind(this)
                    }
                },
                {
                    xtype : 'combo',
                    fieldLabel: t("class"),
                    name: "class",
                    displayField: "text",
                    valueField: "text",
                    store: classesStore,
                    width: 500,
                    value : this.data.class
                },
                {
                    xtype : 'textfield',
                    fieldLabel: t("path"),
                    name: "objectPath",
                    width: 500,
                    value : this.data.objectPath
                },
                {
                    xtype : 'combo',
                    fieldLabel: t("advancedimportexport_cleaner"),
                    name: "cleaner",
                    displayField: "cleaner",
                    valueField: "cleaner",
                    store: pimcore.globalmanager.get("advancedimportexport_cleaners"),
                    value : this.data.cleaner,
                    width: 500,
                    listeners : {
                        change : function (combo, value) {
                            this.data.cleaner = value;
                        }.bind(this)
                    }
                },
            ]
        });

        return this.configForm;
    },

    getProviderSettings : function() {
        if(!this.providerSettings) {
            this.providerSettings = Ext.create({
                xtype : 'panel',
                layout : 'border',
                title : t('advancedimportexport_provider_settings'),
                disabled : true
            });
        }

        if(this.data.provider) {
            this.reloadProviderSettings();
        }

        return this.providerSettings;
    },

    reloadProviderSettings : function() {
        if(this.providerSettings) {
            this.providerSettings.removeAll();

            if(pimcore.plugin.advancedimportexport.provider[this.data.provider] !== undefined) {
                this.providerSettings.add(new pimcore.plugin.advancedimportexport.provider[this.data.provider](this.data.providerConfiguration).getForm());
                this.providerSettings.enable();
            }
        }
    },

    getMappingSettings : function() {
        if(!this.mappingSettings) {
            this.mappingSettings = Ext.create({
                xtype : 'panel',
                layout : 'border',
                title : t('advancedimportexport_mapping_settings'),
                disabled : true
            });
        }

        if(this.data.provider) {
            this.reloadColumnMapping();
        }

        return this.mappingSettings;
    },

    reloadColumnMapping : function() {
        if(this.mappingSettings) {
            this.mappingSettings.removeAll();

            if(this.data.provider) {
                this.mappingSettings.enable();

                Ext.Ajax.request({
                    url: '/plugin/AdvancedImportExport/admin_definition/get-columns',
                    params : {
                        id : this.data.id
                    },
                    method: 'GET',
                    success: function (result) {
                        var config = Ext.decode(result.responseText);
                        var gridStoreData = [];

                        var fromColumnStore = new Ext.data.Store({
                            fields : [
                                'identifier',
                                'label'
                            ],
                            data : config.fromColumns,
                            listeners: {
                                load: function(store){
                                    var rec = { identifier: '', label: '' };
                                    store.insert(0, rec);
                                }
                            }
                        });

                        var toColumnStore = new Ext.data.Store({
                            data : config.toColumns
                        });

                        var gridStore = new Ext.data.Store({
                            grouper : {
                                groupFn : function(item) {
                                    var rec = toColumnStore.findRecord("identifier", item.data.toColumn);

                                    if(rec) {
                                        if (rec.data.type === "objectbrick") {
                                            return rec.data.config.class;
                                        }

                                        return rec.data.type ? rec.data.type : t("fields");
                                    }
                                }
                            },
                            fields : [
                                'fromColumn',
                                'toColumn',
                                'primaryIdentifier'
                            ]
                        });

                        config.toColumns.forEach(function(col) {
                            gridStoreData.push({
                                toColumn : col.id
                            })
                        });


                        gridStore.loadRawData(config.mapping);

                        var cellEditingPlugin = Ext.create('Ext.grid.plugin.CellEditing');

                        var grid = Ext.create({
                            xtype : 'grid',
                            region : 'center',
                            store : gridStore,
                            plugins : [cellEditingPlugin],
                            features: [{
                                ftype: 'grouping',

                                groupHeaderTpl: '{name}'
                            }],
                            columns : {
                                defaults : {},
                                items : [
                                    {
                                        text : t('advancedimportexport_toColumn'),
                                        dataIndex : 'toColumn',
                                        flex : 1,
                                        renderer : function(val, metadata) {
                                            var rec = toColumnStore.findRecord("identifier", val);

                                            if(rec) {
                                                metadata.tdCls = 'pimcore_icon_' + rec.data.fieldtype + ' td-icon';

                                                return rec.data.label;
                                            }

                                            return val;
                                        }
                                    },
                                    {
                                        text : t('advancedimportexport_fromColumn'),
                                        dataIndex : 'fromColumn',
                                        flex : 1,
                                        renderer : function(val) {
                                            if(val) {
                                                var rec = fromColumnStore.findRecord("identifier", val);

                                                if(rec)
                                                    return rec.get("label");
                                            }

                                            return null;
                                        },
                                        editor : {
                                            xtype : 'combo',
                                            store : fromColumnStore,
                                            mode : 'local',
                                            displayField: 'label',
                                            valueField: 'id',
                                            editable : false,
                                            listeners : {
                                                change :  function(combo, newValue, oldValue, eOpts) {
                                                    if(newValue === '') {
                                                        return;
                                                    }
                                                    
                                                    var gridRecord = combo.up("grid").getSelectionModel().getSelection();

                                                    if(gridRecord.length > 0) {
                                                        gridRecord = gridRecord[0];

                                                        var fromColumn = fromColumnStore.findRecord("identifier", newValue);
                                                        var toColumn = toColumnStore.findRecord("identifier", gridRecord .get("toColumn"));

                                                        if(fromColumn && toColumn) {
                                                            var dialog = new pimcore.plugin.advancedimportexport.definition.configDialog();
                                                            dialog.getConfigDialog(fromColumn, toColumn, gridRecord );
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    {
                                        xtype: 'checkcolumn',
                                        text : t('advancedimportexport_primaryIdentifier'),
                                        dataIndex : 'primaryIdentifier',
                                        editor: {
                                            xtype: 'checkbox'
                                        }
                                    },
                                    {
                                        xtype : 'gridcolumn',
                                        dataIndex : 'fromColumn',
                                        flex : 1,
                                        align : 'right',
                                        renderer : function (value, metadata, record) {
                                            var fromColumn = fromColumnStore.findRecord("identifier", record.get("fromColumn"));
                                            var toColumn = toColumnStore.findRecord("identifier", record.get("toColumn"));

                                            if(fromColumn && toColumn)
                                            {
                                                var id = Ext.id();
                                                Ext.defer(function () {
                                                    Ext.widget('button', {
                                                        renderTo: id,
                                                        iconCls : 'pimcore_icon_edit',
                                                        flex : 1,
                                                        cls : 'advancedimportexport-edit-button',
                                                        handler: function () {
                                                            var dialog = new pimcore.plugin.advancedimportexport.definition.configDialog();
                                                            dialog.getConfigDialog(fromColumn, toColumn, record);
                                                        }
                                                    });
                                                }, 50);

                                                return Ext.String.format('<div id="{0}"></div>', id);
                                            }

                                            return '';
                                        }.bind(this)
                                    }
                                ]
                            }

                        });

                        this.mappingSettings.add(grid);
                    }.bind(this)
                });
            }
        }
    },

    getSaveData : function () {
        var data = {
            configuration: {},
            mapping: []
        };

        var mapping = this.mappingSettings.down("grid").getStore().getRange();
        var mappingResult = [];

        mapping.forEach(function(map) {
            if(map.data.fromColumn) {
                mappingResult.push(map.data);
            }
        });

        Ext.apply(data.mapping, mappingResult);
        Ext.apply(data, this.configForm.getForm().getFieldValues());

        if(this.providerSettings.down("form")) {
            Ext.apply(data.configuration, this.providerSettings.down("form").getForm().getFieldValues());
        }

        return {
            data : Ext.encode(data)
        };
    },

    save: function ()
    {
        var saveData = this.getSaveData();

        saveData['id'] = this.data.id;

        Ext.Ajax.request({
            url: this.url.save,
            method: 'post',
            params: saveData,
            success: function (response) {
                try {
                    var res = Ext.decode(response.responseText);

                    if (res.success) {
                        pimcore.helpers.showNotification(t('success'), t('success'), 'success');

                        this.data = res.data;
                    } else {
                        pimcore.helpers.showNotification(t('error'), t('error'),
                            'error', res.message);
                    }
                } catch (e) {
                    pimcore.helpers.showNotification(t('error'), t('error'), 'error');
                }
            }.bind(this)
        });
    }
});