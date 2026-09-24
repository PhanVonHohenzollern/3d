// Every literal flows into an untyped context so int vs double stays visible.
FdPoint3d p0(0, 0, 0);
makeSimpleTube(p0, p0 + vx * 10, 1, 2.0, 3);
makeSimpleTube(p0, p0 + vx * 10, 1.0f, 2L, 0x3);
foo(1, 1.0, 1e0, 0x1, 1u, 1.f, .1, true, "s", 'c');
foo(-1, -1.5, +2, !0, !1.5, -true);
foo(7 / 2, 7 % 2, -7 % 2, 7 % -2, 7.9 % 2, 1 / 3.0);
foo(2147483648 * 2, 4611686018427387904 * 2, 3 - 5, 2 * 3.0);
foo(true + true, true * 3, false - 1, -false);
