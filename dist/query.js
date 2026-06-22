export class QueryChain {
    tableDef;
    executor;
    _filters = {};
    _since;
    _select;
    _limit;
    _offset;
    _orderBy;
    constructor(tableDef, executor) {
        this.tableDef = tableDef;
        this.executor = executor;
    }
    where(filters) {
        Object.assign(this._filters, filters);
        return this;
    }
    since(days) {
        this._since = days;
        return this;
    }
    select(cols) {
        this._select = cols;
        return this;
    }
    limit(n) {
        this._limit = n;
        return this;
    }
    offset(n) {
        this._offset = n;
        return this;
    }
    orderBy(col, dir = 'ASC') {
        this._orderBy = { col, dir };
        return this;
    }
    count() {
        return this.executor.count(this.state());
    }
    fetch() {
        return this.executor.find(this.state());
    }
    stats(col) {
        return this.executor.stats(this.state(), col);
    }
    insert(rows) {
        return this.executor.insert(this.tableDef, rows);
    }
    update(data) {
        return this.executor.update({ tableDef: this.tableDef, data: data, filters: this._filters });
    }
    deleteWhere(filters) {
        return this.executor.deleteWhere({ tableDef: this.tableDef, filters: filters });
    }
    state() {
        return {
            tableDef: this.tableDef,
            filters: this._filters,
            since: this._since,
            select: this._select,
            limit: this._limit,
            offset: this._offset,
            orderBy: this._orderBy,
        };
    }
}
