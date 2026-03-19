import { ObjectId } from 'mongodb'

import { logger } from '../../services/logger.service.js'
import { dbMapUpdateFields, makeId } from '../../services/util.service.js'
import { dbService } from '../../services/db.service.js'
import { asyncLocalStorage } from '../../services/als.service.js'
// const PAGE_SIZE = 3

export const boardService = {
    query,
    getById,
    add,
    update,
    remove,
    // groups
    addBoardGroup,
    updateBoardGroup,
    removeBoardGroup,
    // tasks
    addBoardTask,
    updateBoardTask,
    removeBoardTask,
    // actions
    addBoardAction,
    updateBoardAction,
    removeBoardAction,
    // labels
    addBoardLabel,
    updateBoardLabel,
    removeBoardLabel,
    // members
    addBoardMember,
    updateBoardMember,
    removeBoardMember,
    // msgs
    addBoardMsg,
    updateBoardMsg,
    removeBoardMsg,
}

// ------------------- Board CRUD -------------------

async function query(filterBy = { txt: '' }) {
    console.log('filterBy:', filterBy)
    try {
        const criteria = _buildCriteria(filterBy)
        // const sort = _buildSort(filterBy)
        const collection = await dbService.getCollection('boards')
        const boardCursor = await collection.find(criteria)
        // var boardCursor = await collection.find(criteria, { sort })

        // if (filterBy.pageIdx !== undefined) {
        //     boardCursor.skip(filterBy.pageIdx * PAGE_SIZE).limit(PAGE_SIZE)
        // }

        const boards = boardCursor.toArray()

        return boards
    } catch (err) {
        logger.debug('Error in boardService.query', err.message)
        throw err
    }
}

async function getById(boardId) {
    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }

        const collection = await dbService.getCollection('boards')
        const board = await collection.findOne(criteria)

        if (!board) throw createError(404, 'Board not found')

        board.createdAt = board._id.getTimestamp()
        return board
    } catch (err) {
        logger.debug('Error in boardService.getById', err.message)
        throw err
    }
}

async function add(board) {
    try {
        const collection = await dbService.getCollection('boards')
        await collection.insertOne(board)
        return board
    } catch (err) {
        logger.debug('Error in boardService.add', err.message)
        throw err
    }
}

async function update(board) {
    const { name, desc, closed, dateClosed, isStarred, prefs, idMemberCreator, actions, tasks, labels, groups, members, uploadedImages } = board
    const boardToSave = {
        name,
        desc,
        closed,
        dateClosed,
        isStarred,
        prefs,
        idMemberCreator,
        actions,
        tasks,
        labels,
        groups,
        members,
        uploadedImages
    }

    try {
        const criteria = { _id: ObjectId.createFromHexString(board._id) }
        const collection = await dbService.getCollection('boards')
        const res = await collection.updateOne(criteria, { $set: boardToSave })

        if (res.matchedCount === 0) throw createError(404, 'Board not found to update')

        return board
    } catch (err) {
        logger.debug('Error in boardService.update', err.message)
        throw err
    }
}

async function remove(boardId) {
    // const { loggedinUser } = asyncLocalStorage.getStore()
    // const { _id: ownerId, isAdmin } = loggedinUser

    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }

        // if (!isAdmin) criteria['owner._id'] = ownerId

        const collection = await dbService.getCollection('boards')
        const res = await collection.deleteOne(criteria)

        if (res.deletedCount === 0) throw createError(404, 'Board not found or not your board')

        return boardId
    } catch (err) {
        logger.debug('Error in boardService.remove', err.message)
        throw err
    }
}

// ------------------- Groups CRUD -------------------


async function addBoardGroup(boardId, group) {
    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }

        const collection = await dbService.getCollection('boards')
        await collection.updateOne(criteria, { $push: { groups: group } })

        return group
    } catch (err) {
        logger.debug('Error in boardService.addBoardGroup', err.message)
        throw err
    }
}

async function updateBoardGroup(boardId, groupId, group) {
    try {
        const collection = await dbService.getCollection('boards')
        await collection.updateOne({ 'groups._id': groupId }, { $set: { 'groups.$': group } })

        return group
    } catch (err) {
        logger.debug('Error in boardService.updateBoardGroup', err.message)
        throw err
    }
}

async function removeBoardGroup(boardId, groupId) {
    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }

        const collection = await dbService.getCollection('boards')
        await collection.updateOne(criteria, { $pull: { groups: { _id: groupId } } })

        return groupId
    } catch (err) {
        logger.debug('Error in boardService.removeBoardGroup', err.message)
        throw err
    }
}

// ------------------- Tasks CRUD -------------------

async function addBoardTask(boardId, task) {
    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }

        const collection = await dbService.getCollection('boards')
        await collection.updateOne(criteria, { $push: { tasks: task } })

        return task
    } catch (err) {
        logger.debug('Error in boardService.addBoardTask', err.message)
        throw err
    }
}

async function updateBoardTask(boardId, taskId, fieldsToUpdate) {
    try {
        const collection = await dbService.getCollection('boards')
        const $set = dbMapUpdateFields('tasks', fieldsToUpdate)
        await collection.updateOne(
            { _id: ObjectId.createFromHexString(boardId), 'tasks._id': taskId },
            { $set }
        )

        return { _id: taskId, ...fieldsToUpdate }
    } catch (err) {
        logger.debug('Error in boardService.updateBoardTask', err.message)
        throw err
    }
}

async function removeBoardTask(boardId, taskId) {
    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }

        const collection = await dbService.getCollection('boards')
        await collection.updateOne(criteria, { $pull: { tasks: { _id: taskId } } })

        return taskId
    } catch (err) {
        logger.debug('Error in boardService.removeBoardTask', err.message)
        throw err
    }
}

// ------------------- Actions CRUD -------------------

async function addBoardAction(boardId, action) {
    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }

        const collection = await dbService.getCollection('boards')
        await collection.updateOne(criteria, { $push: { actions: action } })
        return action
    } catch (err) {
        logger.debug('Error in boardService.addBoardAction', err.message)
        throw err
    }
}

async function updateBoardAction(boardId, actionId, action) {
    try {
        const collection = await dbService.getCollection('boards')
        await collection.updateOne({ 'actions._id': actionId }, { $set: { 'actions.$': action } })

        return action
    } catch (err) {
        logger.debug('Error in boardService.updateBoardAction', err.message)
        throw err
    }
}

async function removeBoardAction(boardId, actionId) {
    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }

        const collection = await dbService.getCollection('boards')
        await collection.updateOne(criteria, { $pull: { actions: { _id: actionId } } })

        return actionId
    } catch (err) {
        logger.debug('Error in boardService.removeBoardAction', err.message)
        throw err
    }
}

// ------------------- Labels CRUD -------------------

async function addBoardLabel(boardId, label) {
    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }

        const collection = await dbService.getCollection('boards')
        await collection.updateOne(criteria, { $push: { labels: label } })

        return label
    } catch (err) {
        logger.debug('Error in boardService.addBoardLabel', err.message)
        throw err
    }
}

async function updateBoardLabel(boardId, labelId, label) {
    try {
        const collection = await dbService.getCollection('boards')
        await collection.updateOne({ 'labels._id': labelId }, { $set: { 'labels.$': label } })

        return label
    } catch (err) {
        logger.debug('Error in boardService.updateBoardLabel', err.message)
        throw err
    }
}

async function removeBoardLabel(boardId, labelId) {
    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }

        const collection = await dbService.getCollection('boards')
        await collection.updateOne(criteria, { $pull: { labels: { _id: labelId } } })
        return labelId
    } catch (err) {
        logger.debug('Error in boardService.removeBoardLabel', err.message)
        throw err
    }
}

// ------------------- Members CRUD -------------------

async function addBoardMember(boardId, member) {
    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }

        const collection = await dbService.getCollection('boards')
        await collection.updateOne(criteria, { $push: { members: member } })

        return member
    } catch (err) {
        logger.debug('Error in boardService.addBoardMember', err.message)
        throw err
    }
}

async function updateBoardMember(boardId, memberId, member) {
    try {
        const collection = await dbService.getCollection('boards')
        await collection.updateOne({ 'members._id': memberId }, { $set: { 'members.$': member } })

        return member
    } catch (err) {
        logger.debug('Error in boardService.updateBoardMember', err.message)
        throw err
    }
}

async function removeBoardMember(boardId, memberId) {
    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }

        const collection = await dbService.getCollection('boards')
        await collection.updateOne(criteria, { $pull: { members: { _id: memberId } } })
        return memberId
    } catch (err) {
        logger.debug('Error in boardService.removeBoardMember', err.message)
        throw err
    }
}

// ------------------- Messages CRUD -------------------

async function addBoardMsg(boardId, msg) {
    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }
        msg.id = makeId()

        const collection = await dbService.getCollection('boards')
        await collection.updateOne(criteria, { $push: { msgs: msg } })

        return msg
    } catch (err) {
        logger.debug('Error in boardService.addBoardMsg', err.message)
        throw err
    }
}

async function updateBoardMsg(boardId, msgId, msg) {
    try {
        const collection = await dbService.getCollection('boards')
        await collection.updateOne({ 'msgs.id': msgId }, { $set: { 'msgs.$': msg } })

        return msg
    } catch (err) {
        logger.debug('Error in boardService.updateBoardMsg', err.message)
        throw err
    }
}

async function removeBoardMsg(boardId, msgId) {
    try {
        const criteria = { _id: ObjectId.createFromHexString(boardId) }

        const collection = await dbService.getCollection('boards')
        await collection.updateOne(criteria, { $pull: { msgs: { id: msgId } } })
        return msgId
    } catch (err) {
        logger.debug('Error in boardService.removeBoardMsg', err.message)
        throw err
    }
}

// ------------------- Helpers -------------------

function _buildCriteria(filterBy) {
    const criteria = {
        name: { $regex: filterBy.name || '', $options: 'i' },
    }
    return criteria
}

export function createError(status, message) {
    const err = new Error(message)
    err.status = status
    return err
}