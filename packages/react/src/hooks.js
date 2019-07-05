export const enhance = Base => {
    const fn = props => {
        const context = React.useContext(fn.contextType)

        const {registry, defaultRegistry} = React.useMemo(() => {
            const name = fn.toString();

            return {registry: context[name], defaultRegistry: fn.context}
        }, [context])

        return Base({props, context, registry, defaultRegistry})
    }

    return fn
}