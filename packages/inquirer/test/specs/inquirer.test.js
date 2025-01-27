/**
 * Inquirer public API test
 */

import fs from 'node:fs';
import os from 'node:os';
import stream from 'node:stream';
import tty from 'node:tty';
import { beforeEach, afterEach, describe, it } from 'vitest';
import { expect } from 'chai';
import sinon from 'sinon';
import { Observable } from 'rxjs';

import inquirer from '../../lib/inquirer.js';
import { autosubmit } from '../helpers/events.js';

const ostype = os.type();

describe('inquirer.prompt', () => {
  const sandbox = sinon.createSandbox();
  let prompt;

  beforeEach(() => {
    prompt = inquirer.createPromptModule();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should close and create a new readline instances each time it's called", async () => {
    const promise = prompt({
      type: 'confirm',
      name: 'q1',
      message: 'message',
    });

    const rl1 = promise.ui.rl;
    sandbox.spy(rl1, 'close');
    sandbox.spy(rl1.output, 'end');
    rl1.emit('line');

    return promise.then(() => {
      expect(rl1.close.calledOnce).to.equal(true);
      expect(rl1.output.end.calledOnce).to.equal(true);

      const promise2 = prompt({
        type: 'confirm',
        name: 'q1',
        message: 'message',
      });

      const rl2 = promise2.ui.rl;
      sandbox.spy(rl2, 'close');
      sandbox.spy(rl2.output, 'end');
      rl2.emit('line');

      return promise2.then(() => {
        expect(rl2.close.calledOnce).to.equal(true);
        expect(rl2.output.end.calledOnce).to.equal(true);

        expect(rl1).to.not.equal(rl2);
      });
    });
  });

  it('should close readline instance on rejected promise', async () =>
    new Promise((done) => {
      prompt.registerPrompt('stub', () => {});

      const promise = prompt({
        type: 'stub',
        name: 'q1',
      });

      const rl1 = promise.ui.rl;
      sandbox.spy(rl1, 'close');
      sandbox.spy(rl1.output, 'end');

      promise.catch(() => {
        expect(rl1.close.calledOnce).to.equal(true);
        expect(rl1.output.end.calledOnce).to.equal(true);
        done();
      });
    }));

  it('should take a prompts array and return answers', async () => {
    const prompts = [
      {
        type: 'confirm',
        name: 'q1',
        message: 'message',
      },
      {
        type: 'confirm',
        name: 'q2',
        message: 'message',
        default: false,
      },
    ];

    const promise = prompt(prompts);
    autosubmit(promise.ui);

    return promise.then((answers) => {
      expect(answers.q1).to.equal(true);
      expect(answers.q2).to.equal(false);
    });
  });

  it('should take a prompts nested object and return answers', async () => {
    const prompts = {
      q1: {
        type: 'confirm',
        message: 'message',
      },
      q2: {
        type: 'input',
        message: 'message',
        default: 'Foo',
      },
    };

    const promise = prompt(prompts);
    autosubmit(promise.ui);
    const { q1, q2 } = await promise;
    expect(q1).to.equal(true);
    expect(q2).to.equal('Foo');
  });

  it('should take a prompts array with nested names', async () => {
    const prompts = [
      {
        type: 'confirm',
        name: 'foo.bar.q1',
        message: 'message',
      },
      {
        type: 'confirm',
        name: 'foo.q2',
        message: 'message',
        default: false,
      },
    ];

    const promise = prompt(prompts);
    autosubmit(promise.ui);

    return promise.then((answers) => {
      expect(answers).to.deep.equal({
        foo: {
          bar: {
            q1: true,
          },
          q2: false,
        },
      });
    });
  });

  it('should take a single prompt and return answer', async () => {
    const config = {
      type: 'input',
      name: 'q1',
      message: 'message',
      default: 'bar',
    };

    const promise = prompt(config);

    promise.ui.rl.emit('line');
    const answers = await promise;
    expect(answers.q1).to.equal('bar');
  });

  it('should parse `message` if passed as a function', async () => {
    const stubMessage = 'foo';
    prompt.registerPrompt('stub', function (params) {
      this.run = sinon.stub().returns(Promise.resolve());
      expect(params.message).to.equal(stubMessage);
    });

    const msgFunc = function (answers) {
      expect(answers.name1).to.equal('bar');
      return stubMessage;
    };

    const prompts = [
      {
        type: 'input',
        name: 'name1',
        message: 'message',
        default: 'bar',
      },
      {
        type: 'stub',
        name: 'name',
        message: msgFunc,
      },
    ];

    const promise = prompt(prompts);
    promise.ui.rl.emit('line');
    promise.ui.rl.emit('line');

    await promise;
    // Ensure we're not overwriting original prompt values.
    expect(prompts[1].message).to.equal(msgFunc);
  });

  it('should run asynchronous `messageasync `', () =>
    new Promise((done) => {
      const stubMessage = 'foo';
      prompt.registerPrompt('stub', function (params) {
        this.run = sinon.stub().returns(Promise.resolve());
        expect(params.message).to.equal(stubMessage);
        done();
      });

      const prompts = [
        {
          type: 'input',
          name: 'name1',
          message: 'message',
          default: 'bar',
        },
        {
          type: 'stub',
          name: 'name',
          message(answers) {
            expect(answers.name1).to.equal('bar');
            const goOn = this.async();
            setTimeout(() => {
              goOn(null, stubMessage);
            }, 0);
          },
        },
      ];

      const promise = prompt(prompts);
      promise.ui.rl.emit('line');
    }));

  it('should parse `default` if passed as a function', async () =>
    new Promise((done) => {
      const stubDefault = 'foo';
      prompt.registerPrompt('stub', function (params) {
        this.run = sinon.stub().returns(Promise.resolve());
        expect(params.default).to.equal(stubDefault);
        done();
      });

      const prompts = [
        {
          type: 'input',
          name: 'name1',
          message: 'message',
          default: 'bar',
        },
        {
          type: 'stub',
          name: 'name',
          message: 'message',
          default(answers) {
            expect(answers.name1).to.equal('bar');
            return stubDefault;
          },
        },
      ];

      const promise = prompt(prompts);
      promise.ui.rl.emit('line');
    }));

  it('should run asynchronous `default`', async () => {
    let goesInDefault = false;
    const input2Default = 'foo';
    const prompts = [
      {
        type: 'input',
        name: 'name1',
        message: 'message',
        default: 'bar',
      },
      {
        type: 'input2',
        name: 'q2',
        message: 'message',
        default(answers) {
          goesInDefault = true;
          expect(answers.name1).to.equal('bar');
          const goOn = this.async();
          setTimeout(() => {
            goOn(null, input2Default);
          }, 0);
          setTimeout(() => {
            promise.ui.rl.emit('line');
          }, 10);
        },
      },
    ];

    const promise = prompt(prompts);
    promise.ui.rl.emit('line');

    const answers = await promise;
    expect(goesInDefault).to.equal(true);
    expect(answers.q2).to.equal(input2Default);
  });

  it('should pass previous answers to the prompt constructor', async () =>
    new Promise((done) => {
      prompt.registerPrompt('stub', function (params, rl, answers) {
        this.run = sinon.stub().returns(Promise.resolve());
        expect(answers.name1).to.equal('bar');
        done();
      });

      const prompts = [
        {
          type: 'input',
          name: 'name1',
          message: 'message',
          default: 'bar',
        },
        {
          type: 'stub',
          name: 'name',
          message: 'message',
        },
      ];

      const promise = prompt(prompts);
      promise.ui.rl.emit('line');
    }));

  it('should parse `choices` if passed as a function', async () =>
    new Promise((done) => {
      const stubChoices = ['foo', 'bar'];
      prompt.registerPrompt('stub', function (params) {
        this.run = sinon.stub().returns(Promise.resolve());
        expect(params.choices).to.equal(stubChoices);
        done();
      });

      const prompts = [
        {
          type: 'input',
          name: 'name1',
          message: 'message',
          default: 'bar',
        },
        {
          type: 'stub',
          name: 'name',
          message: 'message',
          choices(answers) {
            expect(answers.name1).to.equal('bar');
            return stubChoices;
          },
        },
      ];

      const promise = prompt(prompts);
      promise.ui.rl.emit('line');
    }));

  it('should returns a promise', async () =>
    new Promise((done) => {
      const config = {
        type: 'input',
        name: 'q1',
        message: 'message',
        default: 'bar',
      };

      const promise = prompt(config);
      promise.then((answers) => {
        expect(answers.q1).to.equal('bar');
        done();
      });

      promise.ui.rl.emit('line');
    }));

  it('should expose the Reactive interface', async () =>
    new Promise((done) => {
      const prompts = [
        {
          type: 'input',
          name: 'name1',
          message: 'message',
          default: 'bar',
        },
        {
          type: 'input',
          name: 'name',
          message: 'message',
          default: 'doe',
        },
      ];

      const promise = prompt(prompts);
      const spy = sinon.spy();
      promise.ui.process.subscribe(
        spy,
        () => {},
        () => {
          sinon.assert.calledWith(spy, { name: 'name1', answer: 'bar' });
          sinon.assert.calledWith(spy, { name: 'name', answer: 'doe' });
          done();
        }
      );

      autosubmit(promise.ui);
    }));

  it('should expose the UI', async () =>
    new Promise((done) => {
      const promise = prompt([]);
      expect(promise.ui.answers).to.be.an('object');
      done();
    }));

  it('takes an Observable as question', async () => {
    const prompts = Observable.create((obs) => {
      obs.next({
        type: 'confirm',
        name: 'q1',
        message: 'message',
      });
      setTimeout(() => {
        obs.next({
          type: 'confirm',
          name: 'q2',
          message: 'message',
          default: false,
        });
        obs.complete();
        promise.ui.rl.emit('line');
      }, 30);
    });

    const promise = prompt(prompts);
    promise.ui.rl.emit('line');

    return promise.then((answers) => {
      expect(answers.q1).to.equal(true);
      expect(answers.q2).to.equal(false);
    });
  });

  it('should take a prompts array and answers and return answers', async () => {
    const prompts = [
      {
        type: 'confirm',
        name: 'q1',
        message: 'message',
      },
    ];

    const answers = { prefiled: true };
    const promise = prompt(prompts, answers);
    autosubmit(promise.ui);

    return promise.then((answers) => {
      expect(answers.prefiled).to.equal(true);
      expect(answers.q1).to.equal(true);
    });
  });

  it('should provide answers in filter callback for lists', async () =>
    new Promise((done) => {
      const filter = sinon.stub();
      filter.returns('foo');

      const prompts = [
        {
          type: 'list',
          name: 'q1',
          default: 'foo',
          choices: ['foo', 'bar'],
          message: 'message',
          filter,
        },
      ];

      const promise = prompt(prompts);
      promise.ui.rl.emit('line');
      promise.then(() => {
        const spyCall = filter.getCall(0);

        expect(spyCall.args[0]).to.equal('foo');
        expect(spyCall.args[1]).to.be.an('object');
        done();
      });
    }));

  describe('hierarchical mode (`when`)', () => {
    it('should pass current answers to `when`', async () => {
      const prompts = [
        {
          type: 'confirm',
          name: 'q1',
          message: 'message',
        },
        {
          name: 'q2',
          message: 'message',
          when(answers) {
            expect(answers).to.be.an('object');
            expect(answers.q1).to.equal(true);
          },
        },
      ];

      const promise = prompt(prompts);

      autosubmit(promise.ui);
      return promise;
    });

    it('should run prompt if `when` returns true', async () => {
      let goesInWhen = false;
      const prompts = [
        {
          type: 'confirm',
          name: 'q1',
          message: 'message',
        },
        {
          type: 'input',
          name: 'q2',
          message: 'message',
          default: 'bar-var',
          when() {
            goesInWhen = true;
            return true;
          },
        },
      ];

      const promise = prompt(prompts);
      autosubmit(promise.ui);

      return promise.then((answers) => {
        expect(goesInWhen).to.equal(true);
        expect(answers.q2).to.equal('bar-var');
      });
    });

    it('should run prompt if `when` is true', async () => {
      const prompts = [
        {
          type: 'confirm',
          name: 'q1',
          message: 'message',
        },
        {
          type: 'input',
          name: 'q2',
          message: 'message',
          default: 'bar-var',
          when: true,
        },
      ];

      const promise = prompt(prompts);
      autosubmit(promise.ui);

      return promise.then((answers) => {
        expect(answers.q2).to.equal('bar-var');
      });
    });

    it('should not run prompt if `when` returns false', async () => {
      let goesInWhen = false;
      const prompts = [
        {
          type: 'confirm',
          name: 'q1',
          message: 'message',
        },
        {
          type: 'confirm',
          name: 'q2',
          message: 'message',
          when() {
            goesInWhen = true;
            return false;
          },
        },
        {
          type: 'input',
          name: 'q3',
          message: 'message',
          default: 'foo',
        },
      ];

      const promise = prompt(prompts);
      autosubmit(promise.ui);

      return promise.then((answers) => {
        expect(goesInWhen).to.equal(true);
        expect(answers.q2).to.equal(undefined);
        expect(answers.q3).to.equal('foo');
        expect(answers.q1).to.equal(true);
      });
    });

    it('should not run prompt if `when` is false', async () => {
      const prompts = [
        {
          type: 'confirm',
          name: 'q1',
          message: 'message',
        },
        {
          type: 'confirm',
          name: 'q2',
          message: 'message',
          when: false,
        },
        {
          type: 'input',
          name: 'q3',
          message: 'message',
          default: 'foo',
        },
      ];

      const promise = prompt(prompts);
      autosubmit(promise.ui);

      return promise.then((answers) => {
        expect(answers.q2).to.equal(undefined);
        expect(answers.q3).to.equal('foo');
        expect(answers.q1).to.equal(true);
      });
    });

    it('should run asynchronous `when`', async () => {
      let goesInWhen = false;
      const prompts = [
        {
          type: 'confirm',
          name: 'q1',
          message: 'message',
        },
        {
          type: 'input',
          name: 'q2',
          message: 'message',
          default: 'foo-bar',
          when() {
            goesInWhen = true;
            const goOn = this.async();
            setTimeout(() => {
              goOn(null, true);
            }, 0);
            setTimeout(() => {
              promise.ui.rl.emit('line');
            }, 10);
          },
        },
      ];

      const promise = prompt(prompts);
      autosubmit(promise.ui);

      return promise.then((answers) => {
        expect(goesInWhen).to.equal(true);
        expect(answers.q2).to.equal('foo-bar');
      });
    });

    it('should get the value which set in `when` on returns false', async () => {
      const prompts = [
        {
          name: 'q',
          message: 'message',
          when(answers) {
            answers.q = 'foo';
            return false;
          },
        },
      ];

      const promise = prompt(prompts);
      autosubmit(promise.ui);

      return promise.then((answers) => {
        expect(answers.q).to.equal('foo');
      });
    });

    it('should not run prompt if answer exists for question', async () => {
      const throwFunc = function (step) {
        throw new Error(`askAnswered Error ${step}`);
      };
      const prompts = [
        {
          type: 'input',
          name: 'prefiled',
          when: throwFunc.bind(undefined, 'when'),
          validate: throwFunc.bind(undefined, 'validate'),
          transformer: throwFunc.bind(undefined, 'transformer'),
          filter: throwFunc.bind(undefined, 'filter'),
          message: 'message',
          default: 'newValue',
        },
      ];

      const answers = { prefiled: 'prefiled' };
      const promise = prompt(prompts, answers);
      autosubmit(promise.ui);

      return promise.then((answers) => {
        expect(answers.prefiled).to.equal('prefiled');
      });
    });

    it('should not run prompt if nested answer exists for question', async () => {
      const throwFunc = function (step) {
        throw new Error(`askAnswered Error ${step}`);
      };
      const prompts = [
        {
          type: 'input',
          name: 'prefiled.nested',
          when: throwFunc.bind(undefined, 'when'),
          validate: throwFunc.bind(undefined, 'validate'),
          transformer: throwFunc.bind(undefined, 'transformer'),
          filter: throwFunc.bind(undefined, 'filter'),
          message: 'message',
          default: 'newValue',
        },
      ];

      const answers = { prefiled: { nested: 'prefiled' } };
      const promise = prompt(prompts, answers);
      autosubmit(promise.ui);

      return promise.then((answers) => {
        expect(answers.prefiled.nested).to.equal('prefiled');
      });
    });

    it('should run prompt if answer exists for question and askAnswered is set', async () => {
      const prompts = [
        {
          askAnswered: true,
          type: 'input',
          name: 'prefiled',
          message: 'message',
          default: 'newValue',
        },
      ];

      const answers = { prefiled: 'prefiled' };
      const promise = prompt(prompts, answers);
      autosubmit(promise.ui);

      return promise.then((answers) => {
        expect(answers.prefiled).to.equal('newValue');
      });
    });

    it('should run prompt if nested answer exists for question and askAnswered is set', async () => {
      const prompts = [
        {
          askAnswered: true,
          type: 'input',
          name: 'prefiled.nested',
          message: 'message',
          default: 'newValue',
        },
      ];

      const answers = { prefiled: { nested: 'prefiled' } };
      const promise = prompt(prompts, answers);
      autosubmit(promise.ui);

      return promise.then((answers) => {
        expect(answers.prefiled.nested).to.equal('newValue');
      });
    });
  });

  describe('#registerPrompt()', () => {
    it('register new prompt types', () =>
      new Promise((done) => {
        const questions = [{ type: 'foo', message: 'something' }];
        inquirer.registerPrompt('foo', function (question, rl, answers) {
          expect(question).to.eql(questions[0]);
          expect(answers).to.eql({});
          this.run = sinon.stub().returns(Promise.resolve());
          done();
        });

        inquirer.prompt(questions);
      }));

    it('overwrite default prompt types', () =>
      new Promise((done) => {
        const questions = [{ type: 'confirm', message: 'something' }];
        inquirer.registerPrompt('confirm', function () {
          this.run = sinon.stub().returns(Promise.resolve());
          done();
        });

        inquirer.prompt(questions);
        inquirer.restoreDefaultPrompts();
      }));
  });

  describe('#restoreDefaultPrompts()', () => {
    it('restore default prompts', async () => {
      const ConfirmPrompt = inquirer.prompt.prompts.confirm;
      inquirer.registerPrompt('confirm', () => {});
      inquirer.restoreDefaultPrompts();
      expect(ConfirmPrompt).to.equal(inquirer.prompt.prompts.confirm);
    });
  });

  // See: https://github.com/SBoudrias/Inquirer.js/pull/326
  it('does not throw exception if cli-width reports width of 0', async () => {
    const original = process.stdout.getWindowSize;
    process.stdout.getWindowSize = function () {
      return [0];
    };

    const localPrompt = inquirer.createPromptModule();

    const prompts = [
      {
        type: 'confirm',
        name: 'q1',
        message: 'message',
      },
    ];

    const promise = localPrompt(prompts);
    promise.ui.rl.emit('line');

    return promise.then((answers) => {
      process.stdout.getWindowSize = original;
      expect(answers.q1).to.equal(true);
    });
  });

  describe('Non-TTY checks', () => {
    let original;

    beforeEach(() => {
      original = process.stdin.isTTY;
      delete process.stdin.isTTY;
    });

    afterEach(() => {
      process.stdin.isTTY = original;
    });

    it('Throw an exception when run in non-tty', async () => {
      const localPrompt = inquirer.createPromptModule({ skipTTYChecks: false });

      const prompts = [
        {
          type: 'confirm',
          name: 'q1',
          message: 'message',
        },
      ];

      const promise = localPrompt(prompts);

      return promise
        .then(() => {
          // Failure
          expect(true).to.equal(false);
        })
        .catch((error) => {
          expect(error.isTtyError).to.equal(true);
        });
    });

    it("Don't throw an exception when run in non-tty by defaultasync ", () =>
      new Promise((done) => {
        const localPrompt = inquirer.createPromptModule();
        const prompts = [
          {
            type: 'confirm',
            name: 'q1',
            message: 'message',
          },
          {
            type: 'confirm',
            name: 'q2',
            message: 'message',
          },
        ];

        const promise = localPrompt(prompts);
        autosubmit(promise.ui);
        promise
          .then(() => {
            done();
          })
          .catch((error) => {
            console.log(error);
            expect(error.isTtyError).to.equal(false);
          });
      }));

    it("Don't throw an exception when run in non-tty and skipTTYChecks is trueasync ", () =>
      new Promise((done) => {
        const prompt = inquirer.createPromptModule({ skipTTYChecks: true });
        const prompts = [
          {
            type: 'confirm',
            name: 'q1',
            message: 'message',
          },
          {
            type: 'confirm',
            name: 'q2',
            message: 'message',
          },
        ];

        const promise = prompt(prompts);
        autosubmit(promise.ui);
        promise
          .then(() => {
            done();
          })
          .catch((error) => {
            console.log(error);
            expect(error.isTtyError).to.equal(false);
          });
      }));

    it("Don't throw an exception when run in non-tty and custom input is providedasync ", () =>
      new Promise((done) => {
        const localPrompt = inquirer.createPromptModule({
          input: new stream.Readable({
            // We must have a default read implementation
            // for this to work, if not it will error out
            // with the following error message during testing
            // Uncaught Error [ERR_METHOD_NOT_IMPLEMENTED]: The _read() method is not implemented
            read() {},
          }),
        });
        const prompts = [
          {
            type: 'confirm',
            name: 'q1',
            message: 'message',
          },
          {
            type: 'confirm',
            name: 'q2',
            message: 'message',
          },
        ];

        const promise = localPrompt(prompts);
        autosubmit(promise.ui);
        promise
          .then(() => {
            done();
          })
          .catch((error) => {
            console.log(error);
            expect(error.isTtyError).to.equal(false);
          });
      }));

    it('Throw an exception when run in non-tty and custom input is provided with skipTTYChecks: false', async () => {
      const localPrompt = inquirer.createPromptModule({
        input: new stream.Readable(),
        skipTTYChecks: false,
      });

      const prompts = [
        {
          type: 'confirm',
          name: 'q1',
          message: 'message',
        },
      ];

      const promise = localPrompt(prompts);

      return promise
        .then(() => {
          // Failure
          expect(true).to.equal(false);
        })
        .catch((error) => {
          expect(error.isTtyError).to.equal(true);
        });
    });

    const itSkipWindows =
      ostype === 'Windows_NT' || process.env.GITHUB_ACTIONS ? it.skip : it;
    itSkipWindows('No exception when using tty other than process.stdin', async () => {
      const input = new tty.ReadStream(fs.openSync('/dev/tty', 'r+'));

      // Uses manually opened tty as input instead of process.stdin
      const localPrompt = inquirer.createPromptModule({
        input,
        skipTTYChecks: false,
      });

      const prompts = [
        {
          type: 'input',
          name: 'q1',
          default: 'foo',
          message: 'message',
        },
      ];

      const promise = localPrompt(prompts);
      promise.ui.rl.emit('line');

      // Release the input tty socket
      input.unref();

      return promise.then((answers) => {
        expect(answers).to.deep.equal({ q1: 'foo' });
      });
    });
  });
});
