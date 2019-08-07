const Component = require(COMPONENT_CLASS_PATH);

class DropDownListComponent extends Component {}

module.exports = {
    selector: 'flk-dropdown-list',
    isChild: false,
    handler: DropDownListComponent,
    isUnique: false,
    component: 'DropDownList',
    htmlFile: __dirname + '/../../flk-dropdown-list.component.html',
};