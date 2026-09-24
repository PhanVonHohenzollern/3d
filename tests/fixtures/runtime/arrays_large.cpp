// Arrays beyond the 8-element summary and 64-element variable limits,
// and nesting beyond the variable depth limit.
//@eval big[70]
//@eval deep[1][1][1][1][1][0]
int big[70];
for (int i = 0; i < 70; i++)
    big[i] = i * i;
int deep[2][2][2][2][2][2];
deep[1][1][1][1][1][1] = 5;
double grid[10][10];
for (int r = 0; r < 10; r++)
    for (int c = 0; c < 10; c++)
        grid[r][c] = r * 10 + c;
makeBox(9, grid, vx, 1, 2, false);
