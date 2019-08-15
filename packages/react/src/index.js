import React from 'react';
import nanoid from 'nanoid';

const isClassComponent = Base =>
    Base === React.Component ||
    Base === React.PureComponent ||
    Boolean(
        Base && Base.prototype && typeof Base.prototype.render === 'function',
    );

const getDisplayName = Base => Base.displayName || Base.name || 'Component';

export const createRegistry = () => {
    const registry = {};

    const RegistryContext = React.createContext(registry);

    const register = (Base, context = {}) => {
        const name = nanoid();

        registry[name] = context;

        return IComp => {
            class Comp extends enhance(Base) {
                static contextType = RegistryContext;
                static registry = registry;
                static toString = () => name;
                static context = context;
            }

            // TODO: add property options
            Object.keys(IComp).forEach(key => {
                if (key === 'name') return;

                Object.defineProperty(Comp, key, {
                    value: IComp[key],
                });
            });

            return Comp;
        };
    };

    class RegistryProvider extends React.Component {
        static contextType = RegistryContext;

        render() {
            const {children, ...props} = this.props;

            return (
                <RegistryContext.Provider
                    value={{
                        ...this.context,
                        ...props,
                    }}
                >
                    {children}
                </RegistryContext.Provider>
            );
        }
    }

    return {register, registry, RegistryContext, RegistryProvider};
};

export const {
    register,
    registry,
    RegistryContext,
    RegistryProvider,
} = createRegistry();
export const {Consumer, Provider} = RegistryContext;

const symbol = key => typeof Symbol !== undefined ? Symbol(key) : `__${key}__`

const SELF = symbol('self');
const MERGE_PROPS = symbol('merge props');
const PROPS = symbol('props');
const CONTEXT_PROPS = symbol('context props');
const RENDER = symbol('render');
const DI = symbol('di');

export const enhance = Base => {
    const Comp = isClassComponent(Base)
        ? Base
        : class BaseComponent extends React.Component {
              render() {
                  return Base(this.props);
              }
          };

    return class RegistryComponent extends Comp {
        static contextType = RegistryContext;
        static displayName = getDisplayName(Base);

        [MERGE_PROPS]({initial, ...props} = this.props) {
            const context = this.context;

            if (initial) return Object.assign(props, this.defaultRegistry);

            for (let key in this.defaultRegistry) {
                props[key] =
                    props[key] ||
                    this.registry[key] ||
                    context[key] ||
                    this.defaultRegistry[key];
            }

            return props;
        }

        constructor(props, context) {
            super(props, context);

            const name = this.constructor.toString();

            this.registry = context[name] || {};
            if (typeof this.registry === 'function') {
                this.registry = this.registry.context || {}
            }
            this.defaultRegistry = this.constructor.context || {};

            if (!this.state) this.state = {};

            Object.defineProperty(this.state, SELF, {
                value: this,
                enumerable: false,
            })

            if (this.componentDidMount) {
                this.componentDidMount = () => {
                    const PREV_PROPS = this.props;
                    this.props = this._props;

                    if (super.componentDidMount) {
                        super.componentDidMount();
                    }

                    this.props = PREV_PROPS;
                };
            }

            if (this.componentDidUpdate) {
                this.componentDidUpdate = () => {
                    const PREV_PROPS = this.props;
                    this.props = this._props;

                    if (super.componentDidUpdate) {
                        super.componentDidUpdate();
                    }

                    this.props = PREV_PROPS;
                };
            }

            if (this.registry.init) {
                this[DI] = true;
                this.registry.init.call(this, props, context);
                return;
            }

            if (this.registry.render) {
                const diRender = this.registry.render;
                const render = this.render.bind(this);

                this[RENDER] = () => {
                    if (typeof diRender === 'string') {
                        return React.createElement(diRender, this.props);
                    }

                    return diRender.call(this, this[PROPS], render);
                };
            }
        }

        [RENDER]() {
            return super.render();
        }

        render() {
            const PREV_PROPS = this.props
            this.props = this._props;
            const result = this[RENDER]();
            this.props = PREV_PROPS;
            return result;
        }

        static getDerivedStateFromProps(props, state) {
            const self = state[SELF];

            let nextState = null;
            let nextProps = props;

            self[PROPS] = props;

            if (!self[DI]) {
                nextProps = self[MERGE_PROPS](props);

                // self.props = nextProps;
            }

            self._props = nextProps;

            if (Base.getDerivedStateFromProps) {
                nextState = Base.getDerivedStateFromProps(nextProps, state);
            }

            if (nextState) {
                nextState[SELF] = self;
            }

            return nextState;
        }
    };
};
