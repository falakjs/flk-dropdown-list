# Dropdown lists

A component to display dropdown lists selections for Falak JS framework. 

# Installation
`flk install flk-dropdown-list`

# Usage

`hello-world.component.html`

```html
<flk-dropdown-list name="countryId" [value]="this.currentCountry.id" placeholder="Search for country" heading="Country" [items]="this.countriesList"></flk-dropdown-list>
```

Basically this component replaces the `select` tag as it offers much much features than the basic tag.

# Configurations

The dropdown list component located in `form.dropdown` location.

# General attributes

List of general attributes.

## heading

**name**: `heading` | `[heading]`

Set the heading text, i.e `user`, `group`

> If the `multiple` flag is set to true, the component will automatically pluralize the heading, i.e if user selects one `group` it will display `1 group`, if selected another group it will display `2 groups` and so on.  

## limit

**name**: `limit` | `[limit]`

**default**: `0`

**Configuration key**: `limit`

Set the limit of displayed items of the performed search, default to display all.  

## theme

**name**: `theme` | `[theme]`

**Available values**: `white` | `white-transparent` | `dark` | `dark-transparent`

**default**: `white`

**Configuration key**: `theme`

Set the dropdown theme.

## Imagable items

**name**: `[imageable]`

**default**: `false`.

If set to `true`, the image will be displayed before the list item.

> Make sure the item object has an `image` key for the image path. 

## Items Exceptions

**name**: `[except]`

**default**: `[]`

Pass list of `values` to be not displayed in the items list.

> The `[except]` attribute accepts only arrays.

## Dropdown position

**name**: `position` | `[position]`

**default**: `bottom`.

**Available values**: `bottom` | `top`

Set the position of the opened dropdown list.

## Using lazy loading

**name**: `[lazy-loading]`

**default**: `false`.

You must declare this attribute to be `true` if you're going to get the data from a `service`.

## Service

**name**: `[service]`

**default**: `null`.

Set the service `object` that will grab the dropdown list.

## Service method

**name**: `[service-method]`

**default**: `list`.

**Configuration key**: `serviceMethod`

Set the method that will be used from the `service` to list the items.

## Close on select

**name**: `[close-on-select]`

**default**: `true` if single selection, `false` if `multiple` selection.

Close the dropdown when user selects an option.

## Close on select

**name**: `[close-on-select]`

**default**: `true` if single selection, `false` if `multiple` selection.

Close the dropdown when user selects an option.

# Input attributes

## name

**name**: `name` | `[name]`

**required**: `false` but **Recommended**

Set the input name.

## placeholder

**name**: `placeholder` | `[placeholder]`

Set the search input placeholder.

## required

**name**: `required` | `[required]`

**default**: `false`

If set to true, the user **MUST** select a value.

## Multiple values

**name**: `[multiple]`

**default**: `false`

If set to `true`, user can select multiple items.

## value

**name**: `value` | `[value]`

Set the selected value of the input.

> if the dropdown is `multiple` selections, then the value **MUST BE** in `array`.
  
## label

**name**: `label` | `[label]`

Set the dropdown label.

# Events

**name**: `select`

Triggered when user selects an item.

> The selected item object is passed to the event.

## Mapping items

**name**: `map` 

Triggered before items are rendered to map the item structure.

Usually this event is used with api responses.

`hello-world.component.html`
```html
<flk-dropdown-list name="countries" [lazy-loading]="true" [service]="this.countriesService" [imageable]="true" (map)="return this.mapCountry(e)"/></flk-dropdown-list>
```

`hello-world.component.js`

```js
class HelloWorld {
    /**
     * Map the country option to match the item schema of the dropdown list component
     * 
     * @param   {object} country
     * @returns object
     */ 
    mapCountry(country) {
        return {
            text: country.name,
            value: country.id,
            image: country.flag, // if there is a country image
        };
    }
}
```