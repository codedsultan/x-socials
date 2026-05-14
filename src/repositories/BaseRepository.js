"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
class BaseRepository {
    adapter;
    modelName;
    constructor(adapter, modelName) {
        this.adapter = adapter;
        this.modelName = modelName;
    }
    async findById(id) {
        return this.adapter.findOne(this.modelName, { id });
    }
    async findOne(filter) {
        return this.adapter.findOne(this.modelName, filter);
    }
    async findMany(filter, options) {
        return this.adapter.findMany(this.modelName, filter, options);
    }
    async create(data) {
        return this.adapter.create(this.modelName, data);
    }
    async update(id, data) {
        return this.adapter.update(this.modelName, id, data);
    }
    async delete(id) {
        return this.adapter.delete(this.modelName, id);
    }
    async exists(filter) {
        const result = await this.adapter.findOne(this.modelName, filter);
        return result !== null;
    }
}
exports.BaseRepository = BaseRepository;
//# sourceMappingURL=BaseRepository.js.map