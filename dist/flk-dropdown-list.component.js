class DropDownList {
    /**
     * Constructor
     * Put your required dependencies in the constructor parameters list  
     */
    constructor(session) {
        this.session = session; // for storing items from ajax requests
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
        this.closeAfter = 200;
        this._closed = true;
        this.currentImage = null;

        this.availableThemes = ['white', 'white-transparent', 'dark', 'dark-transparent'];
    }

    /**
     * Initialize the component
     * This method is triggered before rendering the component
     */
    init() {
        // input options
        this.label = this.inputs.getOption('label');
        this.name = this.inputs.getOption('name', '');
        this.isRequired = !Is.null(this.inputs.getAttr('required')) || this.inputs.getProp('required');
        let value = this.inputs.getProp('value');
        this.placeholder = this.inputs.getOption('placeholder');

        this.heading = this.inputs.getOption('heading');

        this.onSelectEvent = this.inputs.getEvent('select');
        this.limit = this.inputs.getProp('limit', Config.get('form.dropdown.limit', 0));
        this.theme = this.inputs.getOption('theme', Config.get('form.dropdown.theme', this.defaultTheme));

        this.imageable = this.inputs.getProp('imageable', false);
        this.except = this.inputs.getProp('except');

        this.position = this.inputs.getOption('position', 'bottom'); // dropdown list position

        if (this.multiple) {
            this.currentValue = Is.array(value) ? value.map(item => {
                return String(Is.object(item) ? item.id || item.value : item);
            }) : [];
        } else {
            this.currentValue = value ? String(value) : null;
        }

        this.getItemsList();

        if (!this.availableThemes.includes(this.theme)) {
            throw new Error(`flk-dropdownlist: Invalid theme '${this.theme}', available themes are: ${this.availableThemes.join(', ')}. `);
        }

        let closeOnSelect = this.inputs.getOption('closeOnSelect');

        this.closeOnSelect = Is.boolean(closeOnSelect) ? closeOnSelect : this.multiple === false;
    }

    /**
     * Check if the dropdown items will be loaded from a service, endpoint or an http request 
     */
    getItemsList() {
        this.lazyLoading = this.inputs.getProp('lazyLoading');

        this.mapRecordings = this.inputs.getEvent('map', item => {
            let text = Is.scalar(item) ? item : (item.text || item.name || item.title),
                value = Is.scalar(item) ? item : (item.id || item.value),
                image = null;

            if (this.imageable) {
                image = item.image || item.icon;
            }

            value = String(value);

            return { text, value, image };
        });

        const loadFromService = () => {
            this.serviceMethod = this.inputs.getProp('serviceMethod', Config.get('form.dropdown.serviceMethod', 'list'));
            this.service[serviceMethod]().then(records => {
                this.originalItems = Array.clone(records).map(this.mapRecordings);
                this.session.set(this.cacheKey, this.originalItems);
                this.prepareItems(this.originalItems);

                this.isLoadingItems = false;
            });
        };

        if (!this.lazyLoading) {
            let items = this.inputs.getProp('items');
            return this.updateItems(items);
        }

        this.service = this.inputs.getProp('service');

        if (this.service && this.service.list) {
            this.isLoadingItems = true;
            this.cacheKey = 'dl-' + this.service.constructor.name.slice(0, 3).toLowerCase(); // dropdown list - servive name

            if (this.session.has(this.cacheKey)) {
                this.originalItems = this.session.get(this.cacheKey);
                this.prepareItems(this.originalItems);
                this.isLoadingItems = false;
                loadFromService(); // to make sure it is updated
            } else {
                loadFromService();
            }

            return;
        }

        // TODO: // endpoint, http requests
    }

    /**
     * Prepare items list
     * 
     * @param Array items 
     */
    prepareItems(items) {
        this.itemsList = Array.clone(items).map(this.mapRecordings);

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
    updateItems(items) {
        this.items = items;

        if (Is.empty(this.items) && !Is.array(this.items)) {
            let type = Is.null(this.items) ? 'null' : typeof this.items;
            throw new Error(`Invalid "${type}" type for passed [items] value, make sure to pass a valid array of items.`);
        }

        // if the passed items are key/value pairs of object
        // then we will convert it to array.
        if (!Is.array(this.items) && Is.plainObject(this.items)) {
            let arrayedItems = [];

            let reverseKeys = this.inputs.getProp('reverseKeys', false);

            for (let key in this.items) {
                let text = reverseKeys ? this.items[key] : key,
                    value = reverseKeys ? key : this.items[key];

                arrayedItems.push({
                    text,
                    value,
                });
            }

            this.items = arrayedItems;
        }
        this.originalItems = Array.clone(this.items).map(this.mapRecordings);
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

    /**
     * Attach the form 
     */
    attachForm(form) {
        this._formHandler = form ? form.formHandler : null;
    }

    /**
     * Validate input
     */
    validate(input) {
        if (!this.isRequired || input.value && input.checked) return;

        if (Is.empty(this.currentValue)) {
            this._formHandler.addError(this.name, 'required', trans('validation.required'));
            this.error = trans('validation.required');
        }
    }

    /**
     * Search for the given value
     * 
     * @param  string keywords
     */
    searchFor(keywords) {
        let itemsList = this.originalItems.filter(item => item.text.match(new RegExp(keywords, 'i')));

        this.prepareItemsList(itemsList);
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
            itemsList = itemsList.filter(item => !except.includes(item.value));
        }

        itemsList = this.orderItems(itemsList);

        if (this.limit > 0) {
            itemsList = itemsList.slice(0, this.limit);
        }

        this.itemsList = itemsList;
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
    }

    /**
     * Close the dropdown list
     */
    close() {
        this._closed = true;
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
                heading = pluralize(heading, totalCheckedItems, true);
            }
        } else if (this.currentValue) {
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

        return currentItem.text;
    }

    /**
     * Change the state of the given input in the checked items list
     * 
     * @param  HTMLElement input
     * @returns void
     */
    changeStateOf(input) {
        this.checkedItems[input.value] = input.checked;
        if (!this.multiple && input.checked) {
            for (let value in this.checkedItems) {
                if (value == input.value) continue;
                this.checkedItems[value] = false;
            }
        }

        if (this.multiple === false) {
            this.currentValue = input.value;
            if (this.imageable) {
                this.setCurrentImage();
            }
        } else {
            if (input.checked) {
                this.appendSelected(input.value, false);
            } else {
                this.removeSelected(input.value, false);
            }
        }

        if (this.error) {
            this.removeError();
        }

        if (this.multiple) {
            this.itemsList = this.orderItems(this.itemsList);

            this.stopSelecting = this.maxSelections == this.currentValue.length;
        }

        if (this.onSelectEvent) {
            this.onSelectEvent(this.currentValue);
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

        this.currentImage = currentItem[0].image;
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