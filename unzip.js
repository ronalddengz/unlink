// ==UserScript==
// @name         unzip
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  solves LinkedIn Zip puzzles
// @match        https://www.linkedin.com/games/zip*
// @match        https://www.linkedin.com/games/*/zip*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    class ZipSolver {
        constructor() {
            this.grid = null;
            this.size = 0;
            this.cells = [];
            this.numberedCells = new Map();
            this.solution = [];
        }

        parseGrid() {
            const gridElement = document.querySelector('[data-testid="interactive-grid"]');
            if (!gridElement) return false;

            const cellElements = Array.from(gridElement.querySelectorAll('[data-cell-idx]'));
            if (cellElements.length === 0) return false;

            this.size = Math.sqrt(cellElements.length);
            this.cells = [];
            this.numberedCells.clear();

            cellElements.forEach((cell, idx) => {
                const row = Math.floor(idx / this.size);
                const col = idx % this.size;

                const cellData = {
                    idx: idx,
                    row: row,
                    col: col,
                    element: cell,
                    number: null,
                    walls: this.parseWalls(cell),
                    filled: cell.querySelector('[data-testid="filled-cell"]') !== null
                };

                const numberElement = cell.querySelector('[data-cell-content="true"]');
                if (numberElement) {
                    cellData.number = parseInt(numberElement.textContent);
                    this.numberedCells.set(cellData.number, cellData);
                }

                this.cells.push(cellData);
            });

            console.log(`parsed ${this.cells.length} cells (${this.size}x${this.size})`);
            console.log(`found ${this.numberedCells.size} numbered cells:`,
                Array.from(this.numberedCells.keys()).sort((a,b) => a-b));

            return true;
        }

        parseWalls(cell) {
            const walls = {
                top: false,
                right: false,
                bottom: false,
                left: false
            };

            // right wall: _19df68d5 e895eb40 _554e6278 _4ed0b13d _719e249d _1f000af0
            const rightWall = cell.querySelector('._19df68d5.e895eb40._554e6278._4ed0b13d._719e249d._1f000af0');
            if (rightWall) walls.right = true;

            // left wall: _19df68d5 e895eb40 _554e6278 _4ed0b13d _719e249d cb5293b0
            const leftWall = cell.querySelector('._19df68d5.e895eb40._554e6278._4ed0b13d._719e249d.cb5293b0');
            if (leftWall) walls.left = true;

            // bottom wall
            const bottomWall1 = cell.querySelector('._19df68d5.e895eb40._554e6278._4ed0b13d._719e249d._7c915069._4570b77a');
            const bottomWall2 = cell.querySelector('._19df68d5.e895eb40._554e6278._4ed0b13d._719e249d._7c915069.d4a6d52b');
            if (bottomWall1 || bottomWall2) walls.bottom = true;

            // top wall - need to check the cell above for bottom wall

            return walls;
        }

        fixTopWalls() {
            for (let row = 1; row < this.size; row++) {
                for (let col = 0; col < this.size; col++) {
                    const currentCell = this.getCell(row, col);
                    const cellAbove = this.getCell(row - 1, col);
                    if (cellAbove && cellAbove.walls.bottom) {
                        currentCell.walls.top = true;
                    }
                }
            }
        }

        getCell(row, col) {
            if (row < 0 || row >= this.size || col < 0 || col >= this.size) return null;
            return this.cells[row * this.size + col];
        }

        canMove(from, to) {
            if (!from || !to) return false;

            const rowDiff = to.row - from.row;
            const colDiff = to.col - from.col;

            // adjacency check
            if (Math.abs(rowDiff) + Math.abs(colDiff) !== 1) return false;

            // check walls from both sides
            if (rowDiff === -1) { // up
                return !from.walls.top && !to.walls.bottom;
            }
            if (rowDiff === 1) { // down
                return !from.walls.bottom && !to.walls.top;
            }
            if (colDiff === -1) { // left
                return !from.walls.left && !to.walls.right;
            }
            if (colDiff === 1) { // right
                return !from.walls.right && !to.walls.left;
            }

            return true;
        }

        solve() {
            if (!this.parseGrid()) {
                return null;
            }

            this.fixTopWalls();

            const startCell = this.numberedCells.get(1);

            console.log(`starting from cell ${startCell.idx} at (${startCell.row}, ${startCell.col})`);

            const visited = new Set();
            const path = [];

            if (this.backtrack(startCell, visited, path, 1)) {
                this.solution = path;
                console.log(`donesies`);
                return path;
            }

            console.error('no solution');
            return null;
        }

        backtrack(currentCell, visited, path, nextRequiredNumber) {
            visited.add(currentCell.idx);
            path.push(currentCell);

            if (visited.size === this.size * this.size) {
                return true;
            }

            let nextTarget = nextRequiredNumber;
            if (currentCell.number !== null) {
                nextTarget = currentCell.number + 1;
            }

            const directions = [
                [-1, 0], // up
                [1, 0], // down
                [0, -1], // left
                [0, 1] // right
            ];

            for (const [dRow, dCol] of directions) {
                const nextCell = this.getCell(currentCell.row + dRow, currentCell.col + dCol);

                if (!nextCell || visited.has(nextCell.idx)) {
                    continue;
                }

                if (!this.canMove(currentCell, nextCell)) {
                    continue;
                }

                if (nextCell.number !== null && nextCell.number !== nextTarget) {
                    continue;
                }

                if (this.backtrack(nextCell, visited, path, nextTarget)) {
                    return true;
                }
            }

            visited.delete(currentCell.idx);
            path.pop();
            return false;
        }

        execute() {
            if (!this.solution || this.solution.length === 0) {
                console.error('No solution to apply');
                return;
            }

            const keySequence = [];
            for (let i = 1; i < this.solution.length; i++) {
                const prev = this.solution[i - 1];
                const curr = this.solution[i];

                const rowDiff = curr.row - prev.row;
                const colDiff = curr.col - prev.col;

                if (rowDiff === -1) keySequence.push('ArrowUp');
                else if (rowDiff === 1) keySequence.push('ArrowDown');
                else if (colDiff === -1) keySequence.push('ArrowLeft');
                else if (colDiff === 1) keySequence.push('ArrowRight');
            }

            let delay = 0;
            keySequence.forEach((key, index) => {
                setTimeout(() => {
                    this.pressKey(key);
                }, delay);
                delay += 50;
            });
        }

        pressKey(key) {
            const keyCode = this.getKeyCode(key);

            const keyDownEvent = new KeyboardEvent('keydown', {
                key,
                code: key,
                keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true,
                view: window
            });

            const keyUpEvent = new KeyboardEvent('keyup', {
                key,
                code: key,
                keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true,
                view: window
            });

            document.dispatchEvent(keyDownEvent);
            document.body.dispatchEvent(keyDownEvent);

            const grid = document.querySelector('[data-testid="interactive-grid"]');
            if (grid) {
                grid.dispatchEvent(keyDownEvent);
            }

            setTimeout(() => {
                document.dispatchEvent(keyUpEvent);
                document.body.dispatchEvent(keyUpEvent);
                if (grid) {
                    grid.dispatchEvent(keyUpEvent);
                }
            }, 5);
        }

        getKeyCode(key) {
            const keyCodes = {
                'ArrowUp': 38,
                'ArrowDown': 40,
                'ArrowLeft': 37,
                'ArrowRight': 39
            };
            return keyCodes[key] || 0;
        }
    }

    function autoSolve() {
        const gridElement = document.querySelector('[data-testid="interactive-grid"]');
        if (!gridElement) {
            alert('grid not found! make sure the game is loaded.');
            return;
        }

        console.log('starting');
        const solver = new ZipSolver();
        const solution = solver.solve();

        solver.execute();
    }

    function solveButton() {
        if (document.querySelector('#zip-auto-solve-btn')) return;

        const button = document.createElement('button');
        button.id = 'zip-auto-solve-btn';
        button.textContent = 'Auto-Solve Zip';
        button.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 999999;
            padding: 12px 24px;
            background: #0A66C2;
            color: white;
            border: none;
            border-radius: 24px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s;
        `;
        button.addEventListener('mouseenter', () => {
            button.style.background = '#004182';
            button.style.transform = 'translateY(-2px)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = '#0A66C2';
            button.style.transform = 'translateY(0)';
        });
        button.addEventListener('click', () => {
            autoSolve();
        });
        document.body.appendChild(button);
    }

    function waitForGrid() {
        let attempts = 0;
        const maxAttempts = 50;

        const checkInterval = setInterval(() => {
            attempts++;
            const grid = document.querySelector('[data-testid="interactive-grid"]');

            if (grid) {
                clearInterval(checkInterval);
                console.log('grid found');
                solveButton();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.log('grid not found after 50 attempts :(');
            }
        }, 200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForGrid);
    } else {
        waitForGrid();
    }

    const observer = new MutationObserver(() => {
        const grid = document.querySelector('[data-testid="interactive-grid"]');
        if (grid && !document.querySelector('#zip-auto-solve-btn')) {
            solveButton();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();