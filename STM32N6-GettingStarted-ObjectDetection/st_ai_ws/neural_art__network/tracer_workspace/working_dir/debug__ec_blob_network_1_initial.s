;; Start Blob '_ec_blob_network_1'
;; Start Epoch 1
label 0x1
writefield 0 4 [8] 0x1
write 13 0 0x80100
write 13 2 _user_io_input_0(0x0)
write 13 3 0x10000
write 13 6 0x10000
write 13 8 0x0
write 13 7 0x0
write 13 12 0x6
write 13 12 0x7
write 13 14 _user_io_input_0(0x30007)
write 13 13 0x3
write 13 9 0x24
write 13 5 0x0
write 13 18 0x0
write 13 10 0x100000
write 13 17 0x0
writefield 0 4 [0] 0x1
write 5 0 0x80008
write 5 2 0x342e0000
write 5 3 0x1000100
write 5 4 0x30001
write 5 6 0x1
write 5 8 0x30000
write 5 7 0x3
write 5 12 0x6
write 5 12 0x7
write 5 14 0x3431003f
write 5 13 0x3
write 5 9 0x24
write 5 5 0x300
write 5 18 0x0
write 5 10 0x100000
write 5 17 0x0
write 4 0 0x2
poll 4 0 [1] 0x0 100
write 4 0 0x40000000
poll 4 0 [30] 0x0 100
write 4 0 0x1
write 4 2 0x11
writefield 5 0 [0] 0x1
writefield 13 0 [0] 0x1
poll 5 0 [31] 0x0 100
write 4 2 0x0
write 5 0 0x2
poll 5 0 [1] 0x0 100
write 5 0 0x40000000
poll 5 0 [30] 0x0 100
writefield 0 4 [0] 0x0
write 13 0 0x2
poll 13 0 [1] 0x0 100
write 13 0 0x40000000
poll 13 0 [30] 0x0 100
writefield 0 4 [8] 0x0
;; End Epoch 1
irq 0x0
;; End Blob '_ec_blob_network_1'
