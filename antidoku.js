// ==UserScript==
// @name         antidoku
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  solves mini-sudoku
// @match        https://www.linkedin.com/games/mini-sudoku/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    class MiniSudokuSolver {
        constructor() {
            this.grid = [];
            this.prefilled = new Set();
            this.size = 6;
            this.boxRows = 2;
            this.boxCols = 3;
            this.cellElements = [];
            this.solution = null;
        }

        parseGrid() {
            const gridElement = document.querySelector('.sudoku-grid');
            if (!gridElement) return false;

            const cellElements = Array.from(gridElement.querySelectorAll('[data-cell-idx]'));
            if (cellElements.length !== 36) return false;

            this.cellElements = cellElements;
            this.grid = [];
            this.prefilled.clear();

            for (let row = 0; row < this.size; row++) {
                this.grid[row] = [];
                for (let col = 0; col < this.size; col++) {
                    const idx = row * this.size + col;
                    const cell = cellElements[idx];
                    const content = cell.querySelector('.sudoku-cell-content');
                    const text = content ? content.textContent.trim() : '';
                    const num = parseInt(text) || 0;

                    this.grid[row][col] = num;

                    if (cell.classList.contains('sudoku-cell-prefilled')) {
                        this.prefilled.add(idx);
                    }
                }
            }

            console.log('Parsed grid:');
            this.printGrid();
            console.log(`Found ${this.prefilled.size} prefilled cells`);

            return true;
        }

        isValid(row, col, num) {
            for (let c = 0; c < this.size; c++) {
                if (c !== col && this.grid[row][c] === num) return false;
            }

            for (let r = 0; r < this.size; r++) {
                if (r !== row && this.grid[r][col] === num) return false;
            }

            const boxStartRow = Math.floor(row / this.boxRows) * this.boxRows;
            const boxStartCol = Math.floor(col / this.boxCols) * this.boxCols;

            for (let r = boxStartRow; r < boxStartRow + this.boxRows; r++) {
                for (let c = boxStartCol; c < boxStartCol + this.boxCols; c++) {
                    if (r !== row && c !== col && this.grid[r][c] === num) return false;
                }
            }

            return true;
        }

        solve() {
            if (!this.parseGrid()) {
                console.error('could not parse grid');
                return null;
            }

            const originalGrid = this.grid.map(row => [...row]);

            if (this.backtrack()) {
                this.solution = this.grid.map(row => [...row]);
                this.printGrid();
                return this.solution;
            }

            console.error('no solution :(');
            this.grid = originalGrid;
            return null;
        }

        // https://www.geeksforgeeks.org/dsa/sudoku-backtracking-7/
        backtrack() {
            for (let row = 0; row < this.size; row++) {
                for (let col = 0; col < this.size; col++) {
                    if (this.grid[row][col] === 0) {
                        for (let num = 1; num <= 6; num++) {
                            if (this.isValid(row, col, num)) {
                                this.grid[row][col] = num;

                                if (this.backtrack()) {
                                    return true;
                                }

                                this.grid[row][col] = 0;
                            }
                        }
                        return false;
                    }
                }
            }
            return true;
        }

        printGrid() {
            for (let row = 0; row < this.size; row++) {
                let line = this.grid[row].map(n => n || '.').join(' ');
                line = line.slice(0, 5) + ' | ' + line.slice(6);
                console.log(line);
                if ((row + 1) % this.boxRows === 0 && row < this.size - 1) {
                    console.log('------+-------');
                }
            }
        }

        execute() {

            const gridElement = document.querySelector('.sudoku-grid');
            if (!gridElement) return;

            const cellsByRow = [];
            for (let row = 0; row < this.size; row++) {
                cellsByRow[row] = [];
                for (let col = 0; col < this.size; col++) {
                    const idx = row * this.size + col;
                    if (!this.prefilled.has(idx)) {
                        cellsByRow[row].push({
                            row,
                            col,
                            idx,
                            value: this.solution[row][col]
                        });
                    }
                }
            }

            const cellsToFill = [];
            for (let row = 0; row < this.size; row++) {
                if (row % 2 === 0) {
                    cellsToFill.push(...cellsByRow[row]);
                } else {
                    cellsToFill.push(...cellsByRow[row].reverse());
                }
            }

            console.log(`Filling ${cellsToFill.length} cells (snake pattern)...`);

            const actions = [];

            for (let i = 0; i < 6; i++) {
                actions.push('ArrowLeft');
            }
            for (let i = 0; i < 6; i++) {
                actions.push('ArrowUp');
            }

            let currentRow = 0;
            let currentCol = 0;

            for (const cell of cellsToFill) {
                while (currentRow < cell.row) {
                    actions.push('ArrowDown');
                    currentRow++;
                }
                while (currentRow > cell.row) {
                    actions.push('ArrowUp');
                    currentRow--;
                }
                while (currentCol < cell.col) {
                    actions.push('ArrowRight');
                    currentCol++;
                }
                while (currentCol > cell.col) {
                    actions.push('ArrowLeft');
                    currentCol--;
                }
                actions.push(String(cell.value));
            }

            let delay = 0;
            actions.forEach((action) => {
                setTimeout(() => {
                    this.pressKey(action);
                }, delay);
                delay += 100;
            });
        }

        pressKey(key) {
            let keyCode;
            let code;

            if (key.startsWith('Arrow')) {
                const keyCodes = {
                    'ArrowUp': 38,
                    'ArrowDown': 40,
                    'ArrowLeft': 37,
                    'ArrowRight': 39
                };
                keyCode = keyCodes[key];
                code = key;
            } 
            else {
                keyCode = key.charCodeAt(0);
                code = `Digit${key}`;
            }

            const grid = document.querySelector('.sudoku-grid');
            const target = grid || document;

            const keyDownEvent = new KeyboardEvent('keydown', {
                key,
                code,
                keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true,
                view: window
            });

            const keyUpEvent = new KeyboardEvent('keyup', {
                key,
                code,
                keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true,
                view: window
            });

            target.dispatchEvent(keyDownEvent);

            setTimeout(() => {
                target.dispatchEvent(keyUpEvent);
            }, 5);
        }
    }

    function autoSolve() {
        const gridElement = document.querySelector('.sudoku-grid');
        if (!gridElement) {
            return;
        }

        console.log('starting');
        const solver = new MiniSudokuSolver();
        const solution = solver.solve();

        if (solution) {
            solver.execute();
        }
    }

    function solveButton() {
        if (document.querySelector('#minidoku-auto-solve-btn')) return;

        const button = document.createElement('button');
        button.id = 'minidoku-auto-solve-btn';
        button.textContent = 'Auto-Solve Sudoku';
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
            const grid = document.querySelector('.sudoku-grid');

            if (grid) {
                clearInterval(checkInterval);
                console.log('grid found');
                solveButton();
            } 
            else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.log('grid not found after 50 attempts');
            }
        }, 200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForGrid);
    } 
    else {
        waitForGrid();
    }

    const observer = new MutationObserver(() => {
        const grid = document.querySelector('.sudoku-grid');
        if (grid && !document.querySelector('#minidoku-auto-solve-btn')) {
            solveButton();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
