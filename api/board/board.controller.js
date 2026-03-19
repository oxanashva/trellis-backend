import { logger } from '../../services/logger.service.js'
import { boardService } from './board.service.js'

export async function getBoards(req, res, next) {
    try {
        const filterBy = {
            name: req.query.name || '',
        }
        const boards = await boardService.query(filterBy)
        res.json(boards)
    } catch (err) {
        next(err)
    }
}

export async function getBoardById(req, res, next) {
    try {
        const boardId = req.params.id
        const board = await boardService.getById(boardId)
        res.json(board)
    } catch (err) {
        next(err)
    }
}

// ------------------- Board CRUD -------------------

export async function addBoard(req, res, next) {
    // const { loggedinUser, body: board } = req
    const board = req.body

    try {
        // board.owner = loggedinUser
        const addedBoard = await boardService.add(board)
        res.json(addedBoard)
    } catch (err) {
        next(err)
    }
}

export async function updateBoard(req, res, next) {
    // const { loggedinUser, body: board } = req
    // const { _id: userId, isAdmin } = loggedinUser
    const board = req.body

    // if (!isAdmin && board.owner._id !== userId) {
    //     res.status(403).send('Not your board...')
    //     return
    // }

    try {
        const updatedBoard = await boardService.update(board)
        res.json(updatedBoard)
    } catch (err) {
        next(err)
    }
}

export async function removeBoard(req, res, next) {
    try {
        const boardId = req.params.id
        const removedId = await boardService.remove(boardId)
        res.send(removedId)
    } catch (err) {
        next(err)
    }
}

// ------------------- Groups CRUD -------------------

export async function addBoardGroup(req, res, next) {
    try {
        const boardId = req.params.id
        const group = req.body
        const savedGroup = await boardService.addBoardGroup(boardId, group)
        res.send(savedGroup)
    } catch (err) {
        next(err)
    }
}

export async function updateBoardGroup(req, res, next) {
    try {
        const { id: boardId, groupId } = req.params
        const group = req.body
        const savedGroup = await boardService.updateBoardGroup(boardId, groupId, group)
        res.send(savedGroup)
    } catch (err) {
        next(err)
    }
}

export async function removeBoardGroup(req, res, next) {
    try {
        const { id: boardId, groupId } = req.params
        const removedId = await boardService.removeBoardGroup(boardId, groupId)
        res.send(removedId)
    } catch (err) {
        next(err)
    }
}

// ------------------- Tasks CRUD -------------------

export async function addBoardTask(req, res, next) {
    try {
        const boardId = req.params.id
        const task = req.body
        const savedTask = await boardService.addBoardTask(boardId, task)
        res.send(savedTask)
    } catch (err) {
        next(err)
    }
}

export async function updateBoardTask(req, res, next) {
    try {
        const { id: boardId, taskId } = req.params
        const fieldsToUpdate = req.body
        const savedTask = await boardService.updateBoardTask(boardId, taskId, fieldsToUpdate)
        res.send(savedTask)
    } catch (err) {
        next(err)
    }
}

export async function removeBoardTask(req, res, next) {
    try {
        const { id: boardId, taskId } = req.params
        const removedId = await boardService.removeBoardTask(boardId, taskId)
        res.send(removedId)
    } catch (err) {
        next(err)
    }
}

// ------------------- Actions CRUD -------------------

export async function addBoardAction(req, res, next) {
    try {
        const boardId = req.params.id
        const action = req.body
        const savedAction = await boardService.addBoardAction(boardId, action)
        res.send(savedAction)
    } catch (err) {
        next(err)
    }
}

export async function updateBoardAction(req, res, next) {
    try {
        const { id: boardId, actionId } = req.params
        const action = req.body
        const savedAction = await boardService.updateBoardAction(boardId, actionId, action)
        res.send(savedAction)
    } catch (err) {
        next(err)
    }
}

export async function removeBoardAction(req, res, next) {
    try {
        const { id: boardId, actionId } = req.params
        const removedId = await boardService.removeBoardAction(boardId, actionId)
        res.send(removedId)
    } catch (err) {
        next(err)
    }
}

// ------------------- Labels CRUD -------------------

export async function addBoardLabel(req, res, next) {
    try {
        const boardId = req.params.id
        const label = req.body
        const savedLabel = await boardService.addBoardLabel(boardId, label)
        res.send(savedLabel)
    } catch (err) {
        next(err)
    }
}

export async function updateBoardLabel(req, res, next) {
    try {
        const { id: boardId, labelId } = req.params
        const label = req.body
        const savedLabel = await boardService.updateBoardLabel(boardId, labelId, label)
        res.send(savedLabel)
    } catch (err) {
        next(err)
    }
}

export async function removeBoardLabel(req, res, next) {
    try {
        const { id: boardId, labelId } = req.params
        const removedId = await boardService.removeBoardLabel(boardId, labelId)
        res.send(removedId)
    } catch (err) {
        next(err)
    }
}

// ------------------- Members CRUD -------------------

export async function addBoardMember(req, res, next) {
    try {
        const boardId = req.params.id
        const member = req.body
        const savedMember = await boardService.addBoardMember(boardId, member)
        res.send(savedMember)
    } catch (err) {
        next(err)
    }
}

export async function updateBoardMember(req, res, next) {
    try {
        const { id: boardId, memberId } = req.params
        const member = req.body
        const savedMember = await boardService.updateBoardMember(boardId, memberId, member)
        res.send(savedMember)
    } catch (err) {
        next(err)
    }
}

export async function removeBoardMember(req, res, next) {
    try {
        const { id: boardId, memberId } = req.params
        const removedId = await boardService.removeBoardMember(boardId, memberId)
        res.send(removedId)
    } catch (err) {
        next(err)
    }
}

// ------------------- Messages CRUD -------------------

export async function addBoardMsg(req, res, next) {
    const { loggedinUser } = req

    try {
        const boardId = req.params.id
        const msg = {
            txt: req.body.txt,
            by: loggedinUser,
        }
        const savedMsg = await boardService.addBoardMsg(boardId, msg)
        res.send(savedMsg)
    } catch (err) {
        next(err)
    }
}

export async function updateBoardMsg(req, res, next) {
    try {
        const { id: boardId, msgId } = req.params
        const msg = req.body
        const savedMsg = await boardService.updateBoardMsg(boardId, msgId, msg)
        res.send(savedMsg)
    } catch (err) {
        next(err)
    }
}

export async function removeBoardMsg(req, res, next) {
    try {
        const { id: boardId, msgId } = req.params

        const removedId = await boardService.removeBoardMsg(boardId, msgId)
        res.send(removedId)
    } catch (err) {
        next(err)
    }
}
