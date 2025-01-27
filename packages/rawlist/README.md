# `@inquirer/rawlist`

Simple interactive command line prompt to display a raw list of choices (single value select) with minimal interaction.

![rawlist prompt](https://cdn.rawgit.com/SBoudrias/Inquirer.js/28ae8337ba51d93e359ef4f7ee24e79b69898962/assets/screenshots/rawlist.svg)

# Installation

```sh
npm install @inquirer/rawlist

yarn add @inquirer/rawlist
```

# Usage

```js
import rawlist from '@inquirer/rawlist';

const answer = await rawlist({
  message: 'Select a package manager',
  choices: [
    { name: 'npm', value: 'npm' },
    { name: 'yarn', value: 'yarn' },
    { name: 'pnpm', value: 'pnpm' },
  ],
});
```

## Options

| Property | Type      | Required | Description                    |
| -------- | --------- | -------- | ------------------------------ |
| message  | `string`  | yes      | The question to ask            |
| choices  | `Array<{ value: string, name?: string, key?: string }>` | yes       | List of the available choices. The `value` will be returned as the answer, and used as display if no `name` is defined. By default, choices will be selected by index. This can be customized by using the `key` option. |

# License

Copyright (c) 2023 Simon Boudrias (twitter: [@vaxilart](https://twitter.com/Vaxilart))<br/>
Licensed under the MIT license.
