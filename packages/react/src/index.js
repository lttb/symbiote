import React from 'react';
import nanoid from 'nanoid';

const isClassComponent = Comp =>
    Comp === React.Component ||
    Comp === React.PureComponent ||
    Boolean(
        Comp && Comp.prototype && typeof Comp.prototype.render === 'function',
    );

const getDisplayName = Comp => Comp.displayName || Comp.name || 'Component';
const getOwnDisplayName = Comp => {
    if (Comp.hasOwnProperty('displayName')) {
        return Comp.displayName
    }

    return Comp.name
}

export const createRegistry = () => {
    const registry = {};

    const RegistryContext = React.createContext(registry);

    const register = (Base) => {
        return IComp => {
            const name = nanoid();

            registry[name] = Base.contextProps;

            class Comp extends enhance(Base, IComp, {
                RegistryContext,
                registry,
                name,
            }) {}

            Object.keys(IComp).forEach(key => {
                if (key === 'name') return;

                Object.defineProperty(Comp, key, {
                    value: IComp[key],
                    writable: true,
                });
            });

            Comp.displayName = getOwnDisplayName(IComp) || Comp.displayName;

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

const defaults = createRegistry();

export const {
    register,
    registry,
    RegistryContext,
    RegistryProvider,
} = defaults;
export const {Consumer, Provider} = RegistryContext;

const symbol = key => typeof Symbol !== undefined ? Symbol(key) : `__${key}__`

const SELF = symbol('self');
const MERGE_PROPS = symbol('merge props');
const PROPS = symbol('props');
const CONTEXT_PROPS = symbol('context props');
const RENDER = symbol('render');
const DI = symbol('di');

export const enhance = (Base, IComp, {
    RegistryContext = defaults.RegistryContext,
    registry = defaults.registry,
    name = nanoid(),
}) => {
    const {contextProps, mapProps} = IComp;

    const Comp = isClassComponent(Base)
        ? Base
        : class BaseComponent extends React.Component {
              render() {
                  return Base(this.props);
              }
          };

    let Parent = React.Component
    let curr = Base

    while (curr.__proto__) {
        if (curr.__proto__ === React.Component) break
        if (curr.__proto__ === React.PureComponent) {
            Parent = React.PureComponent
            break;
        }
        curr = curr.__proto__
    }

    class RegistryComponent extends Parent {
        static displayName = getDisplayName(Base);
        static contextType = RegistryContext;
        static toString = () => name;

        static registry = registry;
        static contextProps = contextProps;
        static mapProps = mapProps;
        static Base = Base;

        static getDerivedStateFromError = Base.getDerivedStateFromError;

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

            return mapProps ? mapProps(props) : props;
        }

        constructor(props, currentContext) {
            super(props, currentContext);

            this.registry = currentContext[name] || {};
            if (typeof this.registry === 'function') {
                this.registry = this.registry.context || {}
            }
            this.defaultRegistry = contextProps || {};

            if (!this.state) this.state = {};

            this.state = {};
            this.state[SELF] = this
            this.__setState__ = (...args) => this.setState(...args)

            if (this.registry.init) {
                this[DI] = true;
                this.registry.init.call(this, props, currentContext);
                return;
            }

            if (this.registry.render) {
                const diRender = this.registry.render;
                const render = this.render.bind(this);

                this.render = () => {
                    if (typeof diRender === 'string') {
                        return React.createElement(diRender, this.props);
                    }

                    return diRender.call(this, this[PROPS], render);
                };
            }
        }

        render() {
            this.__base__.props = this._props
            this.__base__.state = this.state
            return this.__base__.render();
        }

        static getDerivedStateFromProps(props, state) {
            const self = state[SELF];
            let nextProps = props;
            self[PROPS] = props;

            if (!self[DI]) {
                nextProps = self[MERGE_PROPS](props); // self.props = nextProps;
            }

            self._prevProps = self._props
            self._prevState = state

            self._props = nextProps;

            let nextState = state

            if (!self.__base__) {
                self.__base__ = new Comp(self._props, self.context)
                self.__base__.setState = self.__setState__
                nextState = self.__base__.state || state;
                self.__base__.props = nextProps

                if (self.__base__.componentDidMount) {
                    self.componentDidMount = () => {
                        self.__base__.componentDidMount()
                    }
                }
                if (self.__base__.shouldComponentUpdate) {
                    self.shouldComponentUpdate = (_, nextState) => {
                        return self.__base__.shouldComponentUpdate(self._props, nextState)
                    }
                }
                if (self.__base__.getSnapshotBeforeUpdate) {
                    self.getSnapshotBeforeUpdate = (_, prevState) => {
                        return self.__base__.getSnapshotBeforeUpdate(self._prevProps, prevState)
                    }
                }
                if (self.__base__.componentDidUpdate) {
                    self.componentDidUpdate = (_, prevState, snapshot) => {
                        self.__base__.componentDidUpdate(self._prevProps, prevState, snapshot)
                    }
                }
                if (self.__base__.componentWillUnmount) {
                    self.componentWillUnmount = () => {
                        self.__base__.componentWillUnmount()
                    }
                }
                if (self.__base__.componentDidCatch) {
                    self.componentDidCatch = (error, info) => {
                        self.__base__.componentDidCatch(error, info)
                    }
                }
            }

            if (Base.getDerivedStateFromProps) {
                nextState = Base.getDerivedStateFromProps(nextProps, nextState);
            }

            nextState[SELF] = self

            // self.__base__.props = nextProps
            // self.__base__.state = nextState

            return nextState;
        }
    };

    return RegistryComponent
};
