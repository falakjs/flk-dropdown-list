class DropDownList {
    /**
     * Constructor
     * Put your required dependencies in the constructor parameters list  
     */
    constructor(session, endpoint) {
        this.session = session; // for storing items from ajax requests
        this.endpoint = endpoint; // for storing items from ajax requests
        // user options
        this.searchable = true;
        this.multiple = false;
        this.value = null;
        this.items = null;
        this.placeholder = null;
        this.heading = null;
        this.closeOnSelect = null;
        this.limit = 0;
        this.maxSelections = null;
        this.defaultTheme = 'white';
        this.lazyLoading = false;
        this.isLoadingItems = false;

        // available events
        this.eventsList = [
            'onselect', // triggered when user selects item
        ];

        // internal options
        this.errorClasses = 'error-msg';
        this.error = null;
        this.originalItems = [];
        this.stopSelecting = false;
        this.id = Random.string(5);
        this.checkedItems = {};
        this._formHandler = null;
        this.searchInput = null;
        this.closeAfter = 0;
        this._closed = true;
        this.currentImage = null;

        this.availableThemes = ['white', 'white-transparent', 'dark', 'dark-transparent', 'custom'];

        document.addEventListener('click', e => {
            if (this._closed) return;
            if (e.path && e.path[1] == this.headingBtn) return;

            if (this.labelElement && (e.target == this.labelElement || this.labelElement.contains(e.target))) return;

            if (!this.selectListElement.contains(e.target)) {
                this.close();
            }
        });
    }

    /**
     * Initialize the component
     * This method is triggered before rendering the component
     */
    init() {
        this.handler.observe('value', 'items').onChange('value', value => {
            if (Is.array(this.currentValue)) {
                for (let value of this.currentValue) {
                    this.checkedItems[value] = false;
                }
            } else {
                this.checkedItems[this.currentValue] = false;
            }

            this.updateCurrentValue(value);

            if (Is.array(this.currentValue)) {
                for (let value of this.currentValue) {
                    this.checkedItems[value] = true;
                }
            } else {
                this.checkedItems[this.currentValue] = true;
            }

            if (this.imageable && !this.multiple) {
                this.setCurrentImage();
            }

            this.detectChanges();
        }).onChange('items', items => {
            this.updateItems(items);
        });

        // input options
        this.selectedItems = [];
        this.addtionalClasses = this.prop('class', '');
        this.label = this.prop('label');

        this.multiple = Boolean(this.prop('multiple', false));

        this.name = this.prop('name', '');
        this.icon = this.prop('icon');
        this.isRequired = this.prop('required');
        let value = this.prop('value', null);
        this.placeholder = this.prop('placeholder');
        this.title = this.prop('title');

        this.heading = this.prop('heading');

        this.onSelectEvent = this.inputs.getEvent('select');
        this.limit = this.prop('limit', Config.get('form.dropdown.limit', 0));
        this.theme = this.prop('theme', Config.get('form.dropdown.theme', this.defaultTheme));

        this.imageable = this.prop('imageable', false);
        this.except = this.prop('except');

        this.position = this.prop('position', 'bottom'); // dropdown list position

        this.updateCurrentValue(value);

        this.itemsList = null;

        this.getItemsList();

        if (!this.availableThemes.includes(this.theme)) {
            throw new Error(`@flk/dropdownlist: Invalid theme '${this.theme}', available themes are: ${this.availableThemes.join(', ')}. `);
        }

        let closeOnSelect = this.prop('closeOnSelect');

        this.closeOnSelect = Is.boolean(closeOnSelect) ? closeOnSelect : this.multiple === false;
    }

    updateCurrentValue(value) {
        this.currentValue = null;

        if (this.multiple) {
            this.currentValue = Is.array(value) ? value.map(item => {
                return String(Is.object(item) ? item.id || item.value : item);
            }) : [];
        } else {
            this.currentValue = value !== null ? String(value) : null;
        }
    }

    defaultItemMap(item) {
        let value = Is.scalar(item) ? item : (item.id || item.value),
        image = null;

        let text;

        if (Is.string(item) && !Is.numeric(item)) {
            text = trans(item);
        } else if (Is.object(item)) {
            text = item.text || item.name || item.title;
        } else {
            text = item;
        }

        if (!text && Is.numeric(item)) {
            text = item;
        }

        if (this.imageable) {
            image = item.image || item.icon;
        }

        if (Is.object(text) && text[CURRENT_LOCALE]) {
            text = text[CURRENT_LOCALE];
        }

        value = String(value);

        return { text, value, image };
    }

    /**
     * Check if the dropdown items will be loaded from a service, endpoint or an http request 
     */
    getItemsList() {
        this.lazyLoading = this.prop('lazyLoading');


        // this will be used when response is returning records and we need to take one ore more sub-records from each single record 
        this.mapManyRecordings = this.event('mapMany', null);

        this.items = this.prop('items');

        if (!this.lazyLoading) {
            let items = this.items;
            return this.updateItems(items);
        }

        this.request = null;
        this.service = this.prop('service');
        this.callMethod = this.prop('call');

        if (!this.service && this.prop('service')) {
            this.service = DI.resolve(this.prop('service'));
        }

        this.responseKey = this.prop('responseKey', Config.get('form.dropdown.responseKey', 'records'));

        if (this.service) {
            this.serviceMethod = this.prop('serviceMethod', Config.get('form.dropdown.serviceMethod', 'list'));
            this.request = this.service[this.serviceMethod].bind(this.service);
        } else if (this.callMethod) {
            this.request = this.callMethod;
        } else if (this.prop('request')) {
            this.request = this.prop('request');
        } else if (this.prop('endpoint')) {
            this.request = params => DI.resolve('endpoint').get(this.prop('endpoint'), { data: params });
        }

        // check first if this would be searched through user input search
        this.remoteSearch = this.prop('remoteSearch');

        if (this.remoteSearch) {
            // get the search keywords key
            this.searchKeywordsKey = this.prop('query', 'query');
            if (Is.empty(this.currentValue)) return;
        }

        this.queryParams = this.prop('queryParams', Config.get('form.dropdown.queryParams', {}));

        this.request(this.queryParams).then(response => {
            this.originalItems = Object.get(response, this.responseKey);
            // this.session.set(this.cacheKey, this.originalItems);
            this.prepareItems(this.originalItems);

            this.isLoadingItems = false;
        });

        // TODO: // endpoint, http requests
    }

    /**
     * Prepare item for being added as dropdown item
     * 
     * @param  {object} item 
     * @returns {object}
     */
    mapItem(item) {
        return this.event('map', this.defaultItemMap.bind(this))(item);
    }

    /**
     * Map the given items List
     * 
     * @param {array} items
     * @returns array 
     */
    map(items) {
        let itemsList = [];
        if (this.mapManyRecordings) {
            items.forEach(item => {
                let manyItems = this.mapManyRecordings(item);

                if (manyItems === false) return;

                itemsList = itemsList.concat(manyItems);
            });
        } else {
            itemsList = items.map(this.mapItem.bind(this));            
        }

        itemsList = itemsList.filter(item => item !== false);

        if (this.prop('none') === true) {
            itemsList.unshift({
                text: trans('none'),
                value: DropDownList.noneValue,
                noneInput: true,
            });
        }

        return itemsList;
    }

    /**
     * Prepare items list
     * 
     * @param Array items 
     */
    prepareItems(items) {
        if (this.lazyLoading && !Is.empty(this.items)) {
            items = this.items.concat(items);
        }

        this.itemsList = this.map(Array.clone(items));

        this.itemsList.forEach(item => {
            this.checkedItems[String(item.value)] = this.multiple ? this.currentValue.includes(item.value) : this.currentValue == item.value;
        });

        this.prepareItemsList(this.itemsList);
    }

    /**
     * Update items list
     * 
     * @param {any} items 
     */
    async updateItems(items) {
        this.items = items;
        this.selectedItems = [];

        if (this.items && this.items.constructor.name == 'Promise') {
            this.items = await this.items;
        } else if (Is.empty(this.items)) {
            if (!Is.array(this.items)) {
                let type = Is.null(this.items) ? 'null' : typeof this.items;
                throw new Error(`Invalid "${type}" type for passed [items] value, make sure to pass a valid array of items.`);
            }
        }

        // if the passed items are key/value pairs of object
        // then we will convert it to array.
        if (!Is.array(this.items) && Is.plainObject(this.items)) {
            let arrayedItems = [];

            let reverseKeys = this.prop('reverseKeys', false);

            for (let key in this.items) {
                let text = reverseKeys ? key : this.items[key],
                    value = reverseKeys ? this.items[key] : key;

                arrayedItems.push({
                    text,
                    value,
                });
            }
            this.items = arrayedItems;
        }

        this.originalItems = Array.clone(this.items);
        this.prepareItems(this.originalItems);
    }

    /**
     * Get checked items list
     * 
     * @returns Array
     */
    getCheckedItems() {
        return Is.array(this.currentValue) ? this.currentValue : [this.currentValue];
    }

    ready() {
        this.setForm(this.staticInput);
        
        // open the dropdown when focusing on the button using tab key for example
        window.onkeyup = e => {
            if (! this._closed) return;
            let code = (e.keyCode ? e.keyCode : e.which);
            if (code == 9 && this.headingBtn == document.activeElement) {
                this.toggle();
            }
        };
    }

    setForm(input) {
        if (!input.form || this._formHandler) return;

        this._formHandler = input.form.formHandler;

        this._formHandler.onValidate(form => {
            this.validate();
        });
    }

    /**
     * Validate values
     */
    validate() {
        if (!this.isRequired) return;

        if (Is.empty(this.currentValue)) {
            this._formHandler.addError(this.name, 'required', trans('validation.required'));
            this.error = trans('validation.required');
        } else {
            this._formHandler.removeError(this.name);
        }
    }

    /**
     * Search for the given value
     * 
     * @param  string keywords
     */
    async searchFor(keywords) {
        let itemsList = [];

        if (!keywords && this.remoteSearch) return this.prepareItemsList(itemsList);

        if (!keywords) {
            this.prepareItemsList(this.map(this.originalItems));
            return;
        }

        if (this.remoteSearch) {
            this.searching = true;
            this.detectChanges();
            try {
                let response = await this.request(Object.merge({
                    [this.searchKeywordsKey]: keywords
                }, this.queryParams));

                itemsList = this.map(response[this.responseKey]);

                let appendedItems = itemsList.filter(item => {
                    return !Array.get(this.originalItems, originalItem => item.value == originalItem.value);
                });

                // add the list to the original items and filter it to be uinque only
                this.originalItems = this.originalItems.concat(appendedItems);
            } catch (response) {
                echo(response)
            } finally {
                this.searching = false;
            }
        } else {
            itemsList = this.map(this.originalItems).filter(item => item.text && item.text.match(new RegExp(keywords, 'i')));
        }

        this.prepareItemsList(itemsList);

        this.detectChanges();
    }

    /**
     * Prepare items list in sorting and max displayed items
     * 
     * @param   array itemsList
     * @returns void 
     */
    prepareItemsList(itemsList) {
        if (this.except) {
            let except = (Is.array(this.except) ? this.except : [this.except]).map(value => String(value));
            itemsList = itemsList.filter(item => !except.includes(String(item.value)));
        }

        itemsList = this.orderItems(itemsList);

        this.itemsList = collect(this.selectedItems.concat(itemsList)).unique('value').toArray();

        if (this.imageable) {
            this.setCurrentImage();
        }
    }

    /**
     * Append new item
     * 
     * @param {mixed} item 
     */
    append(item) {
        item = this.mapItem(item);
        this.originalItems.push(item);

        this.selectItem(item);

        this.prepareItems(this.originalItems);
    }

    /**
     * Mark the given item as selected
     * 
     * @param  {object} item 
     * @returns void 
     */
    selectItem(item) {        
        this.checkedItems[item.value] = true;

        if (this.multiple) {
            this.currentValue.push(item.value);
        } else {
            this.currentValue = item.value;
        }
    }

    /**
     * Order the given itemsList based on selected items to be displayed first
     * 
     * @param   array items
     * @returns array
     */
    orderItems(items) {
        return items.sort((itemA, itemB) => {
            let checkedItemA = this.isCheckedItem(itemA),
                checkedItemB = this.isCheckedItem(itemB);

            return checkedItemA === checkedItemB ? 0 : checkedItemA ? -1 : 0;
        });
    }

    /**
     * Get input place holder
     * 
     * @returns string
     */
    getPlaceholder() {
        return this.placeholder || trans('search');
    }

    /**
     * Remove the error
     */
    removeError() {
        this.error = null;
        this._formHandler.removeError(this.name);
    }

    /**
     * Toggle the list items
     */
    toggle() {
        if (this.isLoadingItems) return;
        this._closed = !this._closed;

        if (!this._closed && this.searchInput) {
            setTimeout(() => {
                this.searchInput.focused = true;
                this.searchInput.focus();
            }, 100);
        }

        this.detectChanges();
    }

    /**
     * Close the dropdown list
     */
    close() {
        this._closed = true;

        this.detectChanges();
    }

    /**
     * Get input type based on the multiple option
     */
    getInputType() {
        return this.multiple ? 'checkbox' : 'radio';
    }

    /**
     * Check if the given item is checked
     * 
     * @param  object item
     * returns bool
     */
    isCheckedItem(item) {
        return this.checkedItems[item.value] === true;
    }

    /**
     * Get select list heading
     * 
     * @returns string
     */
    getHeading() {
        if (this.isLoadingItems) return 'Loading...';

        let heading = this.heading || this.placeholder || this.label;

        if (this.multiple) {
            let totalCheckedItems = this.getTotalCheckedItems();
            if (totalCheckedItems > 0) {
                heading = totalCheckedItems + ' ' +  trans(pluralize(heading, totalCheckedItems));
            }
        } else if (this.currentValue !== null) {
            return this.getTextOf(this.currentValue) || heading;
        }

        if (!heading) return trans('please-select');;

        return heading;
    }

    /**
     * Get the text of the given value
     * 
     * @param string value
     * @returns string
     */
    getTextOf(value) {
        if (Is.empty(this.itemsList)) return this.heading || this.placeholder;

        let currentItem = Array.get(this.itemsList, item => item.value == value);

        return currentItem ? currentItem.text : null;
    }

    /**
     * Change the state of the given input in the checked items list
     * 
     * @param  HTMLElement input
     * @returns void
     */
    changeStateOf(input, item) {
        if (! this.multiple && this.checkedItems[input.value] == input.checked) {
            return this.close();
        }
        
        this.checkedItems[input.value] = input.checked;
        if (!this.multiple && input.checked) {
            for (let value in this.checkedItems) {
                if (value == input.value) continue;
                this.checkedItems[value] = false;
            }
        }

        if (Boolean(this.multiple) === false) {
            this.currentValue = input.value;
            if (this.imageable) {
                this.setCurrentImage();
            }
        } else {
            if (item.noneInput) {
                this.currentValue = [];
                this.checkedItems = {};
            } else {
                if (input.checked) {
                    this.appendSelected(input.value, false);
                } else {
                    this.removeSelected(input.value, false);
                }
            }
        }

        if (this.error) {
            this.removeError();
        }

        if (this.multiple) {
            this.itemsList = this.orderItems(this.itemsList);

            this.stopSelecting = this.limit != 0 && this.limit == this.currentValue.length;
        }

        let selectedItems = null;

        if (this.onSelectEvent) {
            if (!this.multiple) {
                selectedItems = input.checked ? item : null;
                this.selectedItems = input.checked ? [item] : [];
            } else {
                if (item.noneInput) {
                    selectedItems = [];
                } else {
                    if (input.checked) {
                        this.selectedItems.push(item);
                    } else {
                        this.selectedItems = Array.remove(this.selectedItems, item);
                    }

                    selectedItems = this.selectedItems;
                    selectedItems = this.itemsList.filter(item => this.currentValue.includes(item.value));
                }
            }

            if (selectedItems) {
                // if the response is false, then remove it from selection
                if (this.onSelectEvent(selectedItems) === false) {
                    this.checkedItems[input.value] = false;

                    if (this.multiple) {
                        this.selectedItems = Array.remove(this.selectedItems, item);
                        this.removeSelected(input.value, false);
                    } else {
                        this.currentValue = null;
                        this.selectedItems = [];
                    }
                }
            }
        }

        if (this.closeOnSelect) {
            setTimeout(() => {
                this.close();
            }, this.closeAfter);
        }

        this.detectChanges(); // because this.checkedItems is not in the html file
    }

    /**
     * Append selected value
     * Works only with `[multiple]` with true
     * 
     * @param {any} value 
     */
    appendSelected(value, detectChanges = true) {
        value = String(value);
        this.currentValue = Array.pushOnce(this.currentValue, value);

        if (detectChanges) {
            this.checkedItems[value] = true;

            this.detectChanges();
        }
    }

    /**
     * Remove selected value
     * Works only with `[multiple]` with true
     * 
     * @param {any} value 
     */
    removeSelected(value, detectChanges = true) {
        value = String(value);
        this.currentValue = Array.remove(this.currentValue, value);

        if (detectChanges) {
            this.checkedItems[value] = false;

            this.detectChanges();
        }
    }


    /**
     * Set current image
     */
    setCurrentImage() {
        let currentItem = this.itemsList.filter(item => item.value == this.currentValue);

        this.currentImage = !Is.empty(currentItem) ? currentItem[0].image : null;
    }

    /**
     * Get total checked items
     * 
     * @returns int
     */
    getTotalCheckedItems() {
        let totalCheckedItems = 0;

        for (let value in this.checkedItems) {
            if (this.checkedItems[value]) {
                totalCheckedItems++;
            }
        }

        return totalCheckedItems;
    }
}

DropDownList.noneValue = '';