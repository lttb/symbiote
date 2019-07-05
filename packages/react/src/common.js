import React from 'react';

const isClassComponent = Base =>
    Base === React.Component ||
    Base === React.PureComponent ||
    Boolean(
        Base && Base.prototype && typeof Base.prototype.render === 'function',
    );

const getDisplayName = Base => Base.displayName || Base.name || 'Component';

export const createRegistry = enhance => {
    const registry = {};

    const RegistryContext = React.createContext(registry);

    const register = (Base, context = {}) => {
        const name = `${Base.name}_${Math.random()}_${Math.random()}`;

        registry[name] = context;

        return IComp => {
            const Comp = enhance(Base)

            Comp.contextType = RegistryContext
            Comp.registry = registry
            Comp.toString = () => name
            Comp.context = context

            // TODO: add property options
            Object.keys(IComp).concat(['displayName', 'defaultProps', 'name']).forEach(key => {
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
} = createRegistry(enhance);
export const {Consumer, Provider} = RegistryContext;

const mergeProps = (data) => {
    const {context, registry, defaultRegistry} = data
    const {initial, ...props} = data.props

    if (initial) return Object.assign(props, defaultRegistry);

    for (let key in defaultRegistry) {
        props[key] =
            props[key] ||
            registry[key] ||
            context[key] ||
            defaultRegistry[key];
    }

    return props;
}