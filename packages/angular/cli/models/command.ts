/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

// tslint:disable:no-global-tslint-disable no-any
import { logging, strings, tags, terminal } from '@angular-devkit/core';
import { getWorkspace } from '../utilities/config';
import {
  Arguments,
  CommandContext,
  CommandDescription,
  CommandDescriptionMap,
  CommandScope,
  CommandWorkspace,
  Option,
} from './interface';

export interface BaseCommandOptions {
  help?: boolean;
  helpJson?: boolean;
}

export abstract class Command<T extends BaseCommandOptions = BaseCommandOptions> {
  public allowMissingWorkspace = false;
  public workspace: CommandWorkspace;

  protected static commandMap: CommandDescriptionMap;
  static setCommandMap(map: CommandDescriptionMap) {
    this.commandMap = map;
  }

  constructor(
    context: CommandContext,
    public readonly description: CommandDescription,
    protected readonly logger: logging.Logger,
  ) {
    this.workspace = context.workspace;
  }

  async initialize(options: T & Arguments): Promise<void> {
    return;
  }

  async printHelp(options: T & Arguments): Promise<number> {
    await this.printHelpUsage();
    await this.printHelpOptions();

    return 0;
  }

  async printJsonHelp(_options: T & Arguments): Promise<number> {
    this.logger.info(JSON.stringify(this.description));

    return 0;
  }

  protected async printHelpUsage() {
    this.logger.info(this.description.description);

    const name = this.description.name;
    const args = this.description.options.filter(x => x.positional !== undefined);
    const opts = this.description.options.filter(x => x.positional === undefined);

    const argDisplay = args && args.length > 0
      ? ' ' + args.map(a => `<${a.name}>`).join(' ')
      : '';
    const optionsDisplay = opts && opts.length > 0
      ? ` [options]`
      : ``;

    this.logger.info(`usage: ng ${name}${argDisplay}${optionsDisplay}`);
    this.logger.info('');
  }

  protected async printHelpOptions(options: Option[] = this.description.options) {
    const args = options.filter(opt => opt.positional !== undefined);
    const opts = options.filter(opt => opt.positional === undefined);

    if (args.length > 0) {
      this.logger.info(`arguments:`);
      args.forEach(o => {
        this.logger.info(`  ${terminal.cyan(o.name)}`);
        if (o.description) {
          this.logger.info(`    ${o.description}`);
        }
      });
    }
    if (options.length > 0) {
      if (args.length > 0) {
        this.logger.info('');
      }
      this.logger.info(`options:`);
      opts
        .filter(o => !o.hidden)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(o => {
          const aliases = o.aliases && o.aliases.length > 0
            ? '(' + o.aliases.map(a => `-${a}`).join(' ') + ')'
            : '';
          this.logger.info(`  ${terminal.cyan('--' + strings.dasherize(o.name))} ${aliases}`);
          if (o.description) {
            this.logger.info(`    ${o.description}`);
          }
        });
    }
  }

  async validateScope(): Promise<void> {
    switch (this.description.scope) {
      case CommandScope.OutProject:
        if (this.workspace.configFile) {
          this.logger.fatal(tags.oneLine`
            The ${this.description.name} command requires to be run outside of a project, but a
            project definition was found at "${this.workspace.configFile}".
          `);
          throw 1;
        }
        break;
      case CommandScope.InProject:
        if (!this.workspace.configFile || getWorkspace('local') === null) {
          this.logger.fatal(tags.oneLine`
            The ${this.description.name} command requires to be run in an Angular project, but a
            project definition could not be found.
          `);
          throw 1;
        }
        break;
      case CommandScope.Everywhere:
        // Can't miss this.
        break;
    }
  }

  abstract async run(options: T & Arguments): Promise<number | void>;

  async validateAndRun(options: T & Arguments): Promise<number | void> {
    if (!options.help && !options.helpJson) {
      await this.validateScope();
    }
    await this.initialize(options);

    if (options.help) {
      return this.printHelp(options);
    } else if (options.helpJson) {
      return this.printJsonHelp(options);
    } else {
      return await this.run(options);
    }
  }
}
